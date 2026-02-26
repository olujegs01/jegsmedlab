"use client";

import { useState, useEffect } from "react";
import { Database, RefreshCw, CheckCircle, Clock, BookOpen, Loader2 } from "lucide-react";
import clsx from "clsx";

interface KnowledgeStatsData {
  collection_size: number;
  scheduler_running: boolean;
  next_scheduled_update: string | null;
  last_update: {
    status: string;
    new_documents_added: number;
    total_collection_size: number;
    breakdown: Record<string, number>;
    duration_seconds: number;
    updated_at: string;
  } | null;
}

export default function KnowledgeStats() {
  const [stats, setStats] = useState<KnowledgeStatsData | null>(null);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/knowledge-stats");
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const triggerUpdate = async () => {
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/update-knowledge", { method: "POST" });
      const data = await res.json();
      setMessage(data.message);
      // Poll for completion
      setTimeout(fetchStats, 30000);
      setTimeout(fetchStats, 90000);
      setTimeout(fetchStats, 180000);
    } catch {
      setMessage("Failed to trigger update");
    } finally {
      setUpdating(false);
    }
  };

  const sourceLabels: Record<string, string> = {
    medlineplus_loinc: "MedlinePlus Labs (LOINC)",
    medlineplus_rss: "MedlinePlus Health Topics",
    pubmed: "PubMed Research Abstracts",
    openfda: "FDA Drug Labels",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-sm text-slate-800">AI Knowledge Base</span>
          {stats?.scheduler_running && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Auto-updating
            </span>
          )}
        </div>
        <button
          onClick={triggerUpdate}
          disabled={updating}
          className={clsx(
            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
            updating
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          )}
        >
          {updating ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</>
          ) : (
            <><RefreshCw className="w-3.5 h-3.5" /> Update Now</>
          )}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Main stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-indigo-700">
              {stats?.collection_size?.toLocaleString() ?? "—"}
            </p>
            <p className="text-xs text-indigo-500 mt-0.5">Medical Documents</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-500 font-medium">Next Update</p>
            </div>
            <p className="text-xs text-slate-700 font-semibold">
              {stats?.next_scheduled_update
                ? new Date(stats.next_scheduled_update).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })
                : "Daily at 3 AM UTC"}
            </p>
          </div>
        </div>

        {/* Data sources */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Data Sources
          </p>
          <div className="space-y-1.5">
            {[
              { key: "medlineplus_loinc", icon: "🧪", label: "NIH MedlinePlus (LOINC codes)", desc: "48 common lab tests" },
              { key: "pubmed", icon: "📄", label: "PubMed Research", desc: "Peer-reviewed abstracts" },
              { key: "medlineplus_rss", icon: "📰", label: "MedlinePlus Topics", desc: "Health topics & drugs" },
              { key: "openfda", icon: "💊", label: "FDA Drug Labels", desc: "Drug-lab interactions" },
            ].map((src) => (
              <div key={src.key} className="flex items-center gap-2 py-1.5 px-2 bg-slate-50 rounded-lg">
                <span className="text-base">{src.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700">{src.label}</p>
                  <p className="text-[10px] text-slate-400">{src.desc}</p>
                </div>
                {stats?.last_update?.breakdown?.[src.key] != null && (
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    +{stats.last_update.breakdown[src.key]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Last update */}
        {stats?.last_update && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-xs text-slate-600">
                Last update: <span className="font-semibold">+{stats.last_update.new_documents_added} docs</span>
                {" "}in {stats.last_update.duration_seconds}s
                {" · "}{new Date(stats.last_update.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-700">{message} Check back in ~3 minutes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
