"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, AlertCircle, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
import clsx from "clsx";

interface Alert {
  id: string;
  report_id: string | null;
  test_name: string;
  value: number | null;
  unit: string | null;
  status: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface AlertBellProps {
  patientId: string;
  onViewReport?: (id: string) => void;
}

const statusIcon = (status: string) => {
  if (status.startsWith("critical")) return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (status === "high" || status === "low") return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  return <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
};

const statusBg = (status: string) => {
  if (status.startsWith("critical")) return "border-l-red-500";
  if (status === "high" || status === "low") return "border-l-amber-400";
  return "border-l-emerald-400";
};

export default function AlertBell({ patientId, onViewReport }: AlertBellProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/alerts?patient_id=${patientId}`);
      if (!res.ok) return;
      const data: Alert[] = await res.json();
      setAlerts(data);
      setUnread(data.filter((a) => !a.is_read).length);
    } catch {}
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [patientId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markRead = async (id: string) => {
    await fetch(`/api/alerts/${id}/read`, { method: "PUT" });
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
    );
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch(`/api/alerts/read-all?patient_id=${patientId}`, { method: "PUT" });
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        title="Alerts"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="font-semibold text-sm text-slate-800">Alerts</span>
              {unread > 0 && (
                <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {alerts.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No alerts yet</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Abnormal lab values will appear here
                </p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={clsx(
                    "px-4 py-3 border-l-4 transition-colors",
                    statusBg(alert.status),
                    alert.is_read ? "bg-white" : "bg-slate-50/60"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {statusIcon(alert.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={clsx("text-xs font-semibold text-slate-800", !alert.is_read && "font-bold")}>
                          {alert.test_name}
                          {alert.value != null && (
                            <span className="font-normal text-slate-500 ml-1">
                              {alert.value} {alert.unit || ""}
                            </span>
                          )}
                        </p>
                        {!alert.is_read && (
                          <button
                            onClick={() => markRead(alert.id)}
                            className="text-[10px] text-blue-600 hover:underline whitespace-nowrap"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-slate-400">
                          {new Date(alert.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                        </span>
                        {alert.report_id && onViewReport && (
                          <button
                            onClick={() => {
                              onViewReport(alert.report_id!);
                              setOpen(false);
                            }}
                            className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:underline"
                          >
                            View report
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
