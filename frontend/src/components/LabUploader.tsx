"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, Image, Loader2, CheckCircle,
  AlertCircle, X, FlaskConical, AlertTriangle, Phone
} from "lucide-react";
import clsx from "clsx";
import AIResponse from "./AIResponse";
import ActionPlanTimeline from "./ActionPlanTimeline";

interface LabUploaderProps {
  onReportUploaded: (reportId: string) => void;
  patientId?: string;
}

interface DrugInteraction {
  medication: string;
  affected_test: string;
  current_value: number;
  unit: string;
  severity: string;
  explanation: string;
  recommendation: string;
}

interface ActionItem {
  timeframe: string;
  category: string;
  action: string;
  reason: string;
  priority: string;
}

interface EmergencyValue {
  test_name: string;
  value: number;
  unit: string;
  emergency_reason: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  severe:   "border-red-300 bg-red-50 text-red-800",
  moderate: "border-amber-300 bg-amber-50 text-amber-800",
  mild:     "border-yellow-200 bg-yellow-50 text-yellow-800",
};

export default function LabUploader({ onReportUploaded, patientId = "demo-patient" }: LabUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [aiText, setAiText] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [emergencyValues, setEmergencyValues] = useState<EmergencyValue[]>([]);
  const [drugInteractions, setDrugInteractions] = useState<DrugInteraction[]>([]);
  const [actionPlan, setActionPlan] = useState<ActionItem[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setAiText("");
      setError(null);
      setDone(false);
      setReportId(null);
      setEmergencyValues([]);
      setDrugInteractions([]);
      setActionPlan([]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/gif": [".gif"],
      "image/webp": [".webp"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStreaming(false);
    setAiText("");
    setError(null);
    setDone(false);
    setEmergencyValues([]);
    setDrugInteractions([]);
    setActionPlan([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/upload-lab?patient_id=${patientId}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Upload failed");
      }

      setUploading(false);
      setStreaming(true);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "report_id") {
              setReportId(data.report_id);
              onReportUploaded(data.report_id);
            } else if (data.type === "text") {
              setAiText((prev) => prev + data.content);
            } else if (data.type === "emergency") {
              setEmergencyValues(data.values || []);
            } else if (data.type === "drug_interactions") {
              setDrugInteractions(data.data || []);
            } else if (data.type === "action_plan") {
              setActionPlan(data.data || []);
            } else if (data.type === "done") {
              setDone(true);
              setStreaming(false);
            }
          } catch (_) {}
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setUploading(false);
      setStreaming(false);
    }
  };

  const reset = () => {
    setFile(null);
    setAiText("");
    setError(null);
    setDone(false);
    setReportId(null);
    setUploading(false);
    setStreaming(false);
    setEmergencyValues([]);
    setDrugInteractions([]);
    setActionPlan([]);
  };

  const isImage = file?.type.startsWith("image/");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Emergency Overlay */}
      {emergencyValues.length > 0 && (
        <div className="fixed inset-0 bg-red-950/95 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl border-4 border-red-500">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                <AlertCircle className="w-9 h-9 text-red-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-red-800 text-center mb-1">
              CRITICAL VALUES DETECTED
            </h2>
            <p className="text-red-700 text-center text-sm font-medium mb-5">
              One or more lab values require immediate medical attention.
            </p>

            <div className="space-y-2 mb-6">
              {emergencyValues.map((v, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-red-800 text-sm">{v.test_name}</span>
                    <span className="font-bold text-red-700 text-sm">{v.value} {v.unit}</span>
                  </div>
                  <p className="text-xs text-red-600 mt-1">{v.emergency_reason}</p>
                </div>
              ))}
            </div>

            <a
              href="tel:911"
              className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl text-lg mb-3 transition-colors"
            >
              <Phone className="w-5 h-5" />
              Call 911 Now
            </a>
            <p className="text-sm font-semibold text-red-700 text-center mb-4">
              OR go to your nearest Emergency Room immediately.
            </p>
            <button
              onClick={() => setEmergencyValues([])}
              className="w-full text-sm text-slate-400 hover:text-slate-600 underline transition-colors"
            >
              I understand — continue viewing report
            </button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-blue-600" />
          Analyze Lab Report
        </h1>
        <p className="text-slate-500 mt-1">
          Upload any lab report — PDF, image, or scanned document — for instant AI interpretation.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Upload Panel */}
        <div className="lg:col-span-2 space-y-4">
          {!file ? (
            <div
              {...getRootProps()}
              className={clsx(
                "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200",
                isDragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <Upload className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              <p className="font-semibold text-slate-700 mb-1">
                {isDragActive ? "Drop your file here" : "Drag & drop your lab report"}
              </p>
              <p className="text-sm text-slate-500 mb-4">or click to browse files</p>
              <div className="flex flex-wrap justify-center gap-2">
                {["PDF", "JPEG", "PNG", "WebP", "TXT"].map((t) => (
                  <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">Max file size: 50MB</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  {isImage ? (
                    <Image className="w-6 h-6 text-blue-500" />
                  ) : (
                    <FileText className="w-6 h-6 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                  </p>
                </div>
                <button onClick={reset} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!streaming && !done && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className={clsx(
                    "mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                    uploading
                      ? "bg-blue-400 text-white cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md"
                  )}
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Uploading & Analyzing...</>
                  ) : (
                    <><FlaskConical className="w-4 h-4" />Analyze with AI</>
                  )}
                </button>
              )}

              {done && (
                <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">Analysis complete!</span>
                </div>
              )}
            </div>
          )}

          {/* What This Does */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">What AI analyzes:</h3>
            <ul className="space-y-2">
              {[
                "Extracts all lab values automatically",
                "Explains each test in plain English",
                "Flags normal, borderline & critical values",
                "Detects drug-lab interactions",
                "Creates your personal action plan",
                "Generates doctor referral letter",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-600">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* AI Results Panel */}
        <div className="lg:col-span-3">
          {!aiText && !streaming && !uploading && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <FlaskConical className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium">AI analysis will appear here</p>
              <p className="text-slate-300 text-sm mt-1">Upload a lab report to get started</p>
            </div>
          )}

          {(aiText || streaming) && (
            <AIResponse
              text={aiText}
              isStreaming={streaming}
              title="Lab Report Analysis"
              reportId={reportId}
            />
          )}

          {/* Drug Interactions Warning */}
          {drugInteractions.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-amber-100 flex items-center gap-3 bg-amber-50">
                <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900">Drug-Lab Interactions Detected</h3>
                  <p className="text-xs text-amber-700">{drugInteractions.length} interaction{drugInteractions.length > 1 ? "s" : ""} found with your medications</p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {drugInteractions.map((interaction, i) => (
                  <div key={i} className={clsx("rounded-xl border p-4", SEVERITY_COLORS[interaction.severity] || SEVERITY_COLORS.mild)}>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">
                        {interaction.medication} → {interaction.affected_test}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/60">
                        {interaction.severity}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{interaction.explanation}</p>
                    <p className="text-xs mt-2 font-medium opacity-80">
                      Recommendation: {interaction.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Plan Timeline */}
          {actionPlan.length > 0 && <ActionPlanTimeline items={actionPlan} />}
        </div>
      </div>
    </div>
  );
}
