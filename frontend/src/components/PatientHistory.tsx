"use client";

import { useState, useEffect } from "react";
import {
  History, FileText, Calendar, ChevronRight,
  CheckCircle, AlertTriangle, AlertCircle, Loader2,
  Download, Share2, Copy, Check, ExternalLink
} from "lucide-react";
import clsx from "clsx";

interface ReportSummary {
  id: string;
  filename: string;
  report_date: string | null;
  lab_name: string | null;
  overall_status: string;
  created_at: string;
  value_count: number;
  summary_preview: string | null;
}

interface ReportDetail {
  id: string;
  filename: string;
  ai_summary: string | null;
  overall_status: string;
  lab_name: string | null;
  report_date: string | null;
  created_at: string;
  lab_values: {
    id: string;
    test_name: string;
    value: number | null;
    unit: string | null;
    reference_low: number | null;
    reference_high: number | null;
    status: string;
    category: string | null;
  }[];
}

interface PatientHistoryProps {
  onViewReport: (id: string) => void;
  patientId?: string;
}

const statusConfig: Record<string, { icon: React.ElementType; label: string; className: string }> = {
  normal: { icon: CheckCircle, label: "Normal", className: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  borderline: { icon: AlertTriangle, label: "Borderline", className: "text-amber-600 bg-amber-50 border-amber-200" },
  concerning: { icon: AlertTriangle, label: "Concerning", className: "text-orange-600 bg-orange-50 border-orange-200" },
  critical: { icon: AlertCircle, label: "Critical", className: "text-red-600 bg-red-50 border-red-200" },
  pending: { icon: Loader2, label: "Processing", className: "text-blue-600 bg-blue-50 border-blue-200" },
};

const valueStatusColors: Record<string, string> = {
  normal: "bg-emerald-100 text-emerald-700",
  low: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical_low: "bg-red-100 text-red-700",
  critical_high: "bg-red-100 text-red-700",
};

export default function PatientHistory({ onViewReport, patientId = "demo-patient" }: PatientHistoryProps) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetch(`/api/history?patient_id=${patientId}`)
      .then((r) => r.json())
      .then((d) => setReports(d))
      .catch(() => setError("Failed to load history"))
      .finally(() => setLoading(false));
  }, [patientId]);

  const loadDetail = async (id: string) => {
    setLoadingDetail(true);
    setShareLink(null);
    try {
      const r = await fetch(`/api/report/${id}`);
      const data = await r.json();
      setSelectedReport(data);
      onViewReport(id);
    } catch {
      setError("Failed to load report");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleShare = async () => {
    if (!selectedReport) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/report/${selectedReport.id}/share`, { method: "POST" });
      const data = await res.json();
      const url = `${window.location.origin}${data.share_url}`;
      setShareLink(url);
    } catch {
      setError("Failed to create share link");
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedReport) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/report/${selectedReport.id}/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `JegsMedLab_${selectedReport.filename || "report"}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric"
    });
  };

  const groupedValues = selectedReport?.lab_values
    ? selectedReport.lab_values.reduce((acc, v) => {
        const cat = v.category || "Other";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(v);
        return acc;
      }, {} as Record<string, typeof selectedReport.lab_values>)
    : {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <History className="w-6 h-6 text-slate-600" />
          Lab History
        </h1>
        <p className="text-slate-500 mt-1">View, share, and export your past lab reports.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Report List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Loading history...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <FileText className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium text-sm">No reports yet</p>
              <p className="text-slate-300 text-xs mt-1">Upload your first lab report to get started</p>
            </div>
          ) : (
            reports.map((r) => {
              const status = statusConfig[r.overall_status] || statusConfig.normal;
              const StatusIcon = status.icon;
              const isSelected = selectedReport?.id === r.id;

              return (
                <button
                  key={r.id}
                  onClick={() => loadDetail(r.id)}
                  className={clsx(
                    "w-full text-left bg-white border rounded-xl p-4 transition-all hover:shadow-sm",
                    isSelected
                      ? "border-blue-400 shadow-sm bg-blue-50/30"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{r.filename}</p>
                        {r.lab_name && (
                          <p className="text-xs text-slate-500">{r.lab_name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-400">
                            {formatDate(r.report_date || r.created_at)}
                          </span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-400">{r.value_count} values</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={clsx("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", status.className)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                  {r.summary_preview && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 pl-12">
                      {r.summary_preview}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Report Detail */}
        <div className="lg:col-span-3">
          {loadingDetail ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Loading report details...</p>
            </div>
          ) : selectedReport ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{selectedReport.filename}</h3>
                    {selectedReport.lab_name && (
                      <p className="text-xs text-slate-500">{selectedReport.lab_name}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(selectedReport.report_date || selectedReport.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const s = statusConfig[selectedReport.overall_status] || statusConfig.normal;
                      const Icon = s.icon;
                      return (
                        <span className={clsx("flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium", s.className)}>
                          <Icon className="w-3 h-3" />
                          {s.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleDownloadPDF}
                    disabled={downloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
                  >
                    {downloading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {downloading ? "Generating..." : "Export PDF"}
                  </button>

                  <button
                    onClick={handleShare}
                    disabled={sharing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
                  >
                    {sharing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                    {sharing ? "Creating..." : "Share Report"}
                  </button>
                </div>

                {/* Share link */}
                {shareLink && (
                  <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <p className="text-xs text-blue-700 truncate flex-1">{shareLink}</p>
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline whitespace-nowrap"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>

              {/* Lab Values by Category */}
              <div className="p-5 max-h-96 overflow-y-auto space-y-4">
                {Object.entries(groupedValues).map(([category, values]) => (
                  <div key={category}>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {category}
                    </h4>
                    <div className="space-y-1.5">
                      {values.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg"
                        >
                          <span className="text-sm text-slate-700 font-medium">{v.test_name}</span>
                          <div className="flex items-center gap-2">
                            {v.value != null && (
                              <span className="text-sm font-semibold text-slate-900">
                                {v.value} {v.unit}
                              </span>
                            )}
                            {v.reference_low != null && v.reference_high != null && (
                              <span className="text-xs text-slate-400">
                                ({v.reference_low}–{v.reference_high})
                              </span>
                            )}
                            <span className={clsx(
                              "text-xs px-2 py-0.5 rounded-full font-medium",
                              valueStatusColors[v.status] || "bg-slate-100 text-slate-600"
                            )}>
                              {v.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Summary Preview */}
              {selectedReport.ai_summary && (
                <div className="px-5 py-4 border-t border-slate-100 bg-blue-50/30">
                  <p className="text-xs font-semibold text-slate-600 mb-2">AI Summary Preview</p>
                  <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed">
                    {selectedReport.ai_summary.slice(0, 400)}...
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center h-full flex flex-col items-center justify-center">
              <FileText className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium text-sm">Select a report to view details</p>
              <p className="text-slate-300 text-xs mt-1">Export as PDF or share with your doctor</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
