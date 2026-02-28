"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Wifi, WifiOff, RefreshCw } from "lucide-react";
import clsx from "clsx";

type Status = "checking" | "online" | "starting" | "offline";

const MAX_RETRIES = 12;      // Try for up to ~90 seconds
const RETRY_INTERVAL = 7500; // Every 7.5 seconds

export default function BackendStatus() {
  const [status, setStatus] = useState<Status>("checking");
  const [retries, setRetries] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        setStatus("online");
        setRetries(0);
        return true;
      }
    } catch {}
    return false;
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      const ok = await check();
      if (!ok) {
        setRetries((r) => {
          const next = r + 1;
          if (next >= MAX_RETRIES) {
            setStatus("offline");
          } else {
            setStatus("starting");
            timer = setTimeout(run, RETRY_INTERVAL);
          }
          return next;
        });
      }
    };

    run();
    return () => clearTimeout(timer);
  }, [check]);

  // Once online, also periodically keep the backend warm
  useEffect(() => {
    if (status !== "online") return;
    const interval = setInterval(() => {
      fetch("/api/health").catch(() => {});
    }, 50000); // every 50 seconds
    return () => clearInterval(interval);
  }, [status]);

  if (status === "online" || dismissed) return null;

  const isOffline = status === "offline";

  return (
    <div className={clsx(
      "fixed top-0 inset-x-0 z-[9999] transition-all",
      isOffline ? "bg-red-600" : "bg-amber-500"
    )}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-white text-sm font-medium">
          {status === "checking" ? (
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          ) : isOffline ? (
            <WifiOff className="w-4 h-4 flex-shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          )}
          <span>
            {status === "checking" && "Connecting to server…"}
            {status === "starting" && `Server is starting up — please wait (Render free tier). Retrying… (${retries}/${MAX_RETRIES})`}
            {isOffline && "Unable to reach server. Please try refreshing or try again in a minute."}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isOffline && (
            <button
              onClick={() => { setStatus("checking"); setRetries(0); check(); }}
              className="flex items-center gap-1.5 text-white text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white text-xs px-2 py-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
