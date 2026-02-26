"use client";

import { useState } from "react";
import { Activity, Plus, X, Loader2, AlertTriangle, Stethoscope, Lightbulb, ClipboardList, ChevronRight } from "lucide-react";
import clsx from "clsx";
import AIResponse from "./AIResponse";

const COMMON_SYMPTOMS = [
  "Fatigue", "Shortness of breath", "Chest pain", "Headache",
  "Dizziness", "Nausea", "Abdominal pain", "Joint pain",
  "Muscle weakness", "Weight gain", "Weight loss", "Hair loss",
  "Excessive thirst", "Frequent urination", "Fever", "Night sweats",
  "Brain fog", "Depression", "Anxiety", "Cold intolerance",
  "Heat intolerance", "Palpitations", "Swollen ankles", "Pale skin",
  "Jaundice", "Back pain", "Numbness/tingling", "Vision changes",
];

const SEVERITY_OPTIONS = [
  { value: "mild", label: "Mild", desc: "Noticeable but manageable", color: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { value: "moderate", label: "Moderate", desc: "Affecting daily activities", color: "border-amber-300 bg-amber-50 text-amber-700" },
  { value: "severe", label: "Severe", desc: "Significantly limiting", color: "border-red-300 bg-red-50 text-red-700" },
];

const HOW_IT_WORKS = [
  {
    icon: Stethoscope,
    step: "1",
    title: "Enter Your Symptoms",
    desc: "Simply enter your symptoms into our AI-powered checker. Our virtual health assistant, trained like a doctor, analyzes your input.",
    color: "bg-purple-600",
    light: "bg-purple-50 text-purple-600",
  },
  {
    icon: Lightbulb,
    step: "2",
    title: "Receive Accurate Insights",
    desc: "Get a detailed analysis and potential diagnosis in seconds. Advanced AI combined with medical knowledge for trusted results.",
    color: "bg-indigo-600",
    light: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: ClipboardList,
    step: "3",
    title: "Access Tailored Recommendations",
    desc: "Receive personalized next steps — from at-home care to suggested specialist referrals based on your specific symptoms.",
    color: "bg-teal-600",
    light: "bg-teal-50 text-teal-600",
  },
];

export default function SymptomChecker({ patientId = "demo-patient" }: { patientId?: string }) {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState("");
  const [context, setContext] = useState("");
  const [aiText, setAiText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const addCustomSymptom = () => {
    const trimmed = customSymptom.trim();
    if (trimmed && !selectedSymptoms.includes(trimmed)) {
      setSelectedSymptoms((prev) => [...prev, trimmed]);
    }
    setCustomSymptom("");
  };

  const handleSubmit = async () => {
    if (selectedSymptoms.length === 0) {
      setError("Please select or add at least one symptom.");
      return;
    }
    setLoading(true);
    setAiText("");
    setError(null);
    setDone(false);

    try {
      const response = await fetch("/api/symptom-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: selectedSymptoms,
          duration,
          severity,
          additional_context: context,
          patient_id: patientId,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let detail = "Request failed";
        try { detail = JSON.parse(text).detail || detail; } catch {}
        throw new Error(detail);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      setLoading(false);

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") {
              setAiText((prev) => prev + data.content);
            } else if (data.type === "done") {
              setDone(true);
            }
          } catch (_) {}
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  const reset = () => {
    setAiText("");
    setDone(false);
    setError(null);
    setSelectedSymptoms([]);
    setDuration("");
    setSeverity("");
    setContext("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-purple-200 text-sm font-medium mb-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            AI Health Assistant · Trained on Medical Knowledge
          </div>
          <h1 className="text-3xl font-bold mb-2">Symptom Checker</h1>
          <p className="text-purple-100 max-w-xl">
            Describe your symptoms and receive a doctor-style analysis with accurate insights
            and personalized recommendations — in seconds.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-4">
        {HOW_IT_WORKS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.step} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
              <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", item.light)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Step {item.step}</p>
                <h3 className="font-semibold text-slate-900 text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content */}
      {!aiText && !loading ? (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 space-y-5">
            {/* Symptom Selection */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-1">
                Select Your Symptoms
              </h3>
              <p className="text-xs text-slate-400 mb-3">Choose all that apply or type your own below</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {COMMON_SYMPTOMS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSymptom(s)}
                    className={clsx(
                      "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                      selectedSymptoms.includes(s)
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-600"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={customSymptom}
                  onChange={(e) => setCustomSymptom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomSymptom()}
                  placeholder="Add another symptom..."
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                />
                <button
                  onClick={addCustomSymptom}
                  className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {selectedSymptoms.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2 font-medium">{selectedSymptoms.length} selected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSymptoms.map((s) => (
                      <span
                        key={s}
                        className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium"
                      >
                        {s}
                        <button onClick={() => toggleSymptom(s)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                How long have you had these symptoms?
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 text-slate-700"
              >
                <option value="">Select duration...</option>
                <option value="Today (acute onset)">Today (acute onset)</option>
                <option value="A few days (2–7 days)">A few days (2–7 days)</option>
                <option value="1–2 weeks">1–2 weeks</option>
                <option value="2–4 weeks">2–4 weeks</option>
                <option value="1–3 months">1–3 months</option>
                <option value="3–6 months">3–6 months</option>
                <option value="More than 6 months (chronic)">More than 6 months (chronic)</option>
              </select>
            </div>

            {/* Severity */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <label className="block text-sm font-semibold text-slate-800 mb-3">Severity</label>
              <div className="space-y-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    className={clsx(
                      "w-full text-left p-3 rounded-lg border transition-all",
                      severity === opt.value
                        ? opt.color
                        : "border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <span className="font-medium text-sm">{opt.label}</span>
                    <span className="text-xs text-slate-500 ml-2">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Additional context */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Additional Context <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Medical history, medications, recent travel, family history, lifestyle changes..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none h-24 text-slate-700"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || selectedSymptoms.length === 0}
              className={clsx(
                "w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                loading || selectedSymptoms.length === 0
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing your symptoms...
                </>
              ) : (
                <>
                  <Stethoscope className="w-4 h-4" />
                  Analyze Symptoms
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Empty state */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center h-full flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 bg-purple-50 rounded-2xl flex items-center justify-center">
                <Stethoscope className="w-10 h-10 text-purple-300" />
              </div>
              <div>
                <p className="text-slate-700 font-semibold text-lg">Your analysis will appear here</p>
                <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                  Select your symptoms on the left and click Analyze to receive your personalized health insights.
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-sm">
                {["🩺 Doctor-style symptom analysis", "💡 Accurate insights & potential diagnoses", "📋 Personalized at-home care & referrals"].map((item) => (
                  <div key={item} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-600 text-left">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Results view */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Analysis for: <span className="text-purple-700">{selectedSymptoms.join(", ")}</span>
              </h2>
              {duration && <p className="text-xs text-slate-400 mt-0.5">Duration: {duration}{severity ? ` · Severity: ${severity}` : ""}</p>}
            </div>
            {done && (
              <button
                onClick={reset}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 border border-purple-200 hover:border-purple-300 px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Analysis
              </button>
            )}
          </div>

          {loading && !aiText && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center">
                  <Stethoscope className="w-8 h-8 text-purple-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-800">Analyzing your symptoms...</p>
                <p className="text-slate-400 text-sm mt-1">Our AI is reviewing your input like a doctor would</p>
              </div>
              <div className="flex gap-2">
                {["Symptom Analysis", "Accurate Insights", "Recommendations"].map((label, i) => (
                  <span key={label} className={clsx(
                    "text-xs px-3 py-1.5 rounded-full font-medium animate-pulse",
                    i === 0 ? "bg-purple-100 text-purple-600" : i === 1 ? "bg-indigo-100 text-indigo-600" : "bg-teal-100 text-teal-600"
                  )} style={{ animationDelay: `${i * 0.3}s` }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {aiText && (
            <AIResponse
              text={aiText}
              isStreaming={!done}
              title="Your Health Analysis"
            />
          )}
        </div>
      )}
    </div>
  );
}
