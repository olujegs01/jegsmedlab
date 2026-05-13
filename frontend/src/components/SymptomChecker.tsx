"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, X, Loader2, AlertTriangle, Stethoscope,
  Lightbulb, ClipboardList, ChevronRight, Thermometer,
  Shield, ChevronDown, Mic, MicOff, Download, Send,
  MessageCircle, RotateCcw, FileText,
} from "lucide-react";
import clsx from "clsx";
import AIResponse from "./AIResponse";
import BodyMap, { REGION_TO_SYSTEM } from "./BodyMap";
import { exportSymptomPDF } from "../lib/exportSymptomPDF";

// ── Symptom library ───────────────────────────────────────────────────────────
const SYMPTOMS_BY_SYSTEM: Record<string, string[]> = {
  "General": ["Fatigue", "Fever", "Chills", "Night sweats", "Weight loss", "Weight gain", "Loss of appetite", "General malaise"],
  "Heart & Lungs": ["Chest pain", "Shortness of breath", "Palpitations", "Swollen ankles", "Cough", "Wheezing", "Rapid heartbeat"],
  "Brain & Nerves": ["Headache", "Dizziness", "Fainting", "Numbness/tingling", "Vision changes", "Memory problems", "Brain fog", "Confusion"],
  "Digestive": ["Nausea", "Vomiting", "Abdominal pain", "Bloating", "Diarrhea", "Constipation", "Heartburn", "Jaundice"],
  "Hormonal": ["Excessive thirst", "Frequent urination", "Cold intolerance", "Heat intolerance", "Hair loss", "Skin changes", "Mood changes"],
  "Muscles & Joints": ["Joint pain", "Muscle weakness", "Muscle cramps", "Back pain", "Neck pain", "Swelling in joints"],
  "Mental Health": ["Depression", "Anxiety", "Insomnia", "Panic attacks", "Mood swings", "Irritability"],
  "Skin": ["Rash", "Itching", "Pale skin", "Bruising easily", "Hives", "Dry skin"],
};

// ── Emergency detection ───────────────────────────────────────────────────────
const EMERGENCY_RULES: { check: (s: string[], sev: string) => boolean; msg: string }[] = [
  {
    check: (s) => s.includes("Chest pain") && s.includes("Shortness of breath"),
    msg: "Chest pain with shortness of breath may indicate a heart attack or pulmonary embolism — call 911 or go to the ER immediately.",
  },
  {
    check: (s, sev) => s.includes("Chest pain") && sev === "severe",
    msg: "Severe chest pain requires emergency evaluation — call 911 or go to the ER immediately.",
  },
  {
    check: (s) => s.includes("Fainting") && s.includes("Chest pain"),
    msg: "Fainting with chest pain may signal a serious cardiac event — seek emergency care now.",
  },
  {
    check: (s) => s.includes("Confusion") && (s.includes("Vision changes") || s.includes("Numbness/tingling")),
    msg: "Sudden confusion with vision changes or numbness may be signs of a stroke (FAST: Face, Arms, Speech, Time). Call 911.",
  },
];

const SEVERITY_OPTIONS = [
  { value: "mild", label: "Mild", desc: "Noticeable but manageable", cls: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { value: "moderate", label: "Moderate", desc: "Affecting daily activities", cls: "border-amber-300 bg-amber-50 text-amber-700" },
  { value: "severe", label: "Severe", desc: "Significantly limiting", cls: "border-red-300 bg-red-50 text-red-700" },
];

const URGENCY_STYLES: Record<string, { label: string; cls: string }> = {
  emergency: { label: "🚨 Emergency", cls: "bg-red-100 text-red-700 border-red-200" },
  urgent: { label: "🔴 Urgent", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  schedule_soon: { label: "🟡 Schedule Soon", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  routine: { label: "🟢 Routine", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const SECTIONS = [
  { keyword: "Red Flag", label: "Red Flag Assessment" },
  { keyword: "Symptom Analysis", label: "Symptom Analysis" },
  { keyword: "Differential Diagnosis", label: "Differential Diagnosis" },
  { keyword: "Triage", label: "Triage & Urgency" },
  { keyword: "Action Plan", label: "Action Plan" },
];

function detectSection(text: string): string {
  let current = "Preparing analysis...";
  for (const s of SECTIONS) {
    if (text.includes(s.keyword)) current = s.label;
  }
  return current;
}

const HOW_IT_WORKS = [
  { Icon: Stethoscope, step: "1", title: "Map & Select Symptoms", desc: "Use the interactive body map or tabs to select symptoms, add vitals, and enter demographics.", color: "bg-purple-50 text-purple-600" },
  { Icon: Lightbulb, step: "2", title: "AI Clinical Analysis", desc: "Claude Opus performs ICD-10 differential diagnosis with red-flag detection and triage scoring.", color: "bg-indigo-50 text-indigo-600" },
  { Icon: ClipboardList, step: "3", title: "Report & Chat", desc: "Get a personalized action plan, export a PDF for your doctor, and ask follow-up questions.", color: "bg-teal-50 text-teal-600" },
];

interface VitalSigns {
  temperature_f: string;
  heart_rate: string;
  systolic_bp: string;
  diastolic_bp: string;
  oxygen_saturation: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SymptomChecker({ patientId = "demo-patient" }: { patientId?: string }) {
  // Form state
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [activeSystem, setActiveSystem] = useState("General");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState("");
  const [context, setContext] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [showVitals, setShowVitals] = useState(false);
  const [vitals, setVitals] = useState<VitalSigns>({
    temperature_f: "", heart_rate: "", systolic_bp: "", diastolic_bp: "", oxygen_saturation: "",
  });

  // Analysis state
  const [aiText, setAiText] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [urgencyLevel, setUrgencyLevel] = useState("");

  // Follow-up chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Voice input state
  const [isListening, setIsListening] = useState(false);

  // History
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetch(`/api/symptom-history?patient_id=${patientId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => Array.isArray(d) && setPastSessions(d))
      .catch(() => {});
  }, [patientId, done]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Emergency detection
  const emergencyWarning = useMemo(() => {
    for (const rule of EMERGENCY_RULES) {
      if (rule.check(selectedSymptoms, severity)) return rule.msg;
    }
    return null;
  }, [selectedSymptoms, severity]);

  const currentSection = useMemo(() => detectSection(aiText), [aiText]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggleSymptom = (s: string) =>
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const addCustomSymptom = () => {
    const t = customSymptom.trim().slice(0, 80);
    if (t && !selectedSymptoms.includes(t) && selectedSymptoms.length < 30) {
      setSelectedSymptoms((prev) => [...prev, t]);
    }
    setCustomSymptom("");
  };

  const handleBodyRegionClick = (region: string, system: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
    setActiveSystem(system);
  };

  const buildVitalsPayload = () => {
    const v: Record<string, number> = {};
    if (vitals.temperature_f) v.temperature_f = parseFloat(vitals.temperature_f);
    if (vitals.heart_rate) v.heart_rate = parseInt(vitals.heart_rate);
    if (vitals.systolic_bp) v.systolic_bp = parseInt(vitals.systolic_bp);
    if (vitals.diastolic_bp) v.diastolic_bp = parseInt(vitals.diastolic_bp);
    if (vitals.oxygen_saturation) v.oxygen_saturation = parseInt(vitals.oxygen_saturation);
    return Object.keys(v).length > 0 ? v : undefined;
  };

  // ── Voice Input ────────────────────────────────────────────────────────────
  const startVoiceInput = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition is not supported in this browser. Try Chrome or Edge."); return; }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);
    recognition.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      setCustomSymptom(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  // ── Main analysis submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (selectedSymptoms.length === 0) { setError("Please select or add at least one symptom."); return; }
    setLoading(true);
    setStreaming(false);
    setAiText("");
    setError(null);
    setDone(false);
    setUrgencyLevel("");
    setChatMessages([]);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch("/api/symptom-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          symptoms: selectedSymptoms,
          duration: duration || undefined,
          severity: severity || undefined,
          additional_context: context || undefined,
          patient_id: patientId,
          age: age ? parseInt(age) : undefined,
          sex: sex || undefined,
          vital_signs: buildVitalsPayload(),
        }),
      });

      if (!res.ok) {
        let detail = `Error ${res.status}`;
        try { detail = (await res.json()).detail || detail; } catch {}
        if (res.status === 429) detail = "Too many requests — please wait before trying again.";
        throw new Error(detail);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      setLoading(false);
      setStreaming(true);

      while (true) {
        const { done: rd, value } = await reader.read();
        if (rd) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") setAiText((p) => p + data.content);
            else if (data.type === "done") {
              setDone(true);
              setStreaming(false);
              if (data.urgency_level) setUrgencyLevel(data.urgency_level);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setError(err.message || "Unexpected error. Please try again.");
      setLoading(false);
      setStreaming(false);
    }
  };

  // ── Follow-up chat submit ──────────────────────────────────────────────────
  const handleChatSubmit = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: q }]);
    setChatLoading(true);

    const assistantIndex = chatMessages.length + 1;
    setChatMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch("/api/symptom-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: q,
          analysis_context: aiText.slice(0, 8000),
          symptoms: selectedSymptoms,
        }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: rd, value } = await reader.read();
        if (rd) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") {
              buffer += data.content;
              setChatMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: buffer, streaming: true };
                return updated;
              });
            } else if (data.type === "done") {
              setChatMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: buffer, streaming: false };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, I couldn't process that question. Please try again.", streaming: false };
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  // ── PDF export ─────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    exportSymptomPDF({
      symptoms: selectedSymptoms,
      duration,
      severity,
      age,
      sex,
      urgencyLevel,
      aiText,
    });
  };

  const reset = () => {
    setAiText(""); setDone(false); setStreaming(false); setError(null);
    setUrgencyLevel(""); setSelectedSymptoms([]); setSelectedRegions([]);
    setDuration(""); setSeverity(""); setContext(""); setAge(""); setSex("");
    setVitals({ temperature_f: "", heart_rate: "", systolic_bp: "", diastolic_bp: "", oxygen_saturation: "" });
    setChatMessages([]); setChatInput("");
  };

  const showForm = !aiText && !loading && !streaming;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="relative bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-4 right-4 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-purple-200 text-sm font-medium mb-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Claude Opus · ICD-10 Differential Diagnosis · Body Map · PDF Export · Voice Input
          </div>
          <h1 className="text-3xl font-bold mb-2">Symptom Checker</h1>
          <p className="text-purple-100 max-w-xl text-sm">
            Click the interactive body map or browse by system to select symptoms. Get a clinical-grade
            AI assessment, then ask follow-up questions and export a PDF report for your doctor.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-4">
        {HOW_IT_WORKS.map(({ Icon, step, title, desc, color }) => (
          <div key={step} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4">
            <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Step {step}</p>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">{title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Past Analyses */}
      {pastSessions.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
          >
            <ChevronRight className={clsx("w-4 h-4 transition-transform", showHistory && "rotate-90")} />
            Past Analyses ({pastSessions.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {pastSessions.map((s) => {
                const urg = URGENCY_STYLES[s.urgency_level] || URGENCY_STYLES.routine;
                return (
                  <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex flex-wrap gap-1">
                        {(s.symptoms || []).slice(0, 4).map((sym: string) => (
                          <span key={sym} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{sym}</span>
                        ))}
                        {s.symptoms?.length > 4 && <span className="text-xs text-slate-400">+{s.symptoms.length - 4}</span>}
                      </div>
                      <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium border whitespace-nowrap", urg.cls)}>{urg.label}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">
                        {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <button
                        onClick={() => { setAiText(s.ai_analysis); setUrgencyLevel(s.urgency_level); setDone(true); setShowHistory(false); setSelectedSymptoms(s.symptoms || []); }}
                        className="text-xs text-purple-600 font-medium hover:underline"
                      >
                        View Full Analysis →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── FORM ──────────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* LEFT: Inputs */}
          <div className="lg:col-span-2 space-y-4">

            {/* Body Map + Demographics row */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-purple-500" />
                Patient Demographics
              </h3>
              <div className="flex gap-4 items-start">
                {/* SVG Body Map */}
                <BodyMap selectedRegions={selectedRegions} onRegionClick={handleBodyRegionClick} />

                {/* Demographics fields */}
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Age</label>
                    <input
                      type="number" min={1} max={120} value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 35"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Sex</label>
                    <select
                      value={sex} onChange={(e) => setSex(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 text-slate-700"
                    >
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">Click body regions on the map to jump to relevant symptoms.</p>
                </div>
              </div>
            </div>

            {/* Symptom Selection */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-1">Select Symptoms</h3>
              <p className="text-xs text-slate-400 mb-3">Browse by body system or speak/type your own</p>

              {/* System tabs */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.keys(SYMPTOMS_BY_SYSTEM).map((sys) => (
                  <button
                    key={sys}
                    onClick={() => setActiveSystem(sys)}
                    className={clsx(
                      "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
                      activeSystem === sys
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-slate-500 border-slate-200 hover:border-purple-300 hover:text-purple-600"
                    )}
                  >
                    {sys}
                  </button>
                ))}
              </div>

              {/* Symptom chips */}
              <div className="flex flex-wrap gap-2 mb-3 min-h-[56px]">
                {(SYMPTOMS_BY_SYSTEM[activeSystem] || []).map((s) => (
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

              {/* Custom + voice input */}
              <div className="flex gap-2">
                <input
                  type="text" value={customSymptom}
                  onChange={(e) => setCustomSymptom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomSymptom()}
                  placeholder={isListening ? "Listening..." : "Add or speak a symptom..."}
                  maxLength={80}
                  className={clsx(
                    "flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300",
                    isListening ? "border-purple-400 bg-purple-50" : "border-slate-200"
                  )}
                />
                <button
                  onClick={startVoiceInput}
                  disabled={isListening}
                  title="Voice input"
                  className={clsx(
                    "p-2 rounded-lg transition-colors",
                    isListening ? "bg-red-100 text-red-600" : "bg-slate-100 hover:bg-purple-100 text-slate-500 hover:text-purple-600"
                  )}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button onClick={addCustomSymptom} className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Selected pills */}
              {selectedSymptoms.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2 font-medium">{selectedSymptoms.length} selected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSymptoms.map((s) => (
                      <span key={s} className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">
                        {s}
                        <button onClick={() => toggleSymptom(s)}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <label className="block text-sm font-semibold text-slate-800 mb-2">How long have you had these symptoms?</label>
              <select
                value={duration} onChange={(e) => setDuration(e.target.value)}
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
                      severity === opt.value ? opt.cls : "border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <span className="font-medium text-sm">{opt.label}</span>
                    <span className="text-xs text-slate-500 ml-2">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Vital Signs */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowVitals(!showVitals)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-purple-500" />
                  Vital Signs <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </span>
                <ChevronDown className={clsx("w-4 h-4 text-slate-400 transition-transform", showVitals && "rotate-180")} />
              </button>
              {showVitals && (
                <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                  {[
                    { key: "temperature_f", label: "Temp (°F)", placeholder: "98.6" },
                    { key: "heart_rate", label: "Heart Rate (bpm)", placeholder: "72" },
                    { key: "systolic_bp", label: "Systolic BP", placeholder: "120" },
                    { key: "diastolic_bp", label: "Diastolic BP", placeholder: "80" },
                    { key: "oxygen_saturation", label: "SpO2 (%)", placeholder: "98" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-500 mb-1">{label}</label>
                      <input
                        type="number"
                        value={vitals[key as keyof VitalSigns]}
                        onChange={(e) => setVitals((v) => ({ ...v, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Additional Context */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Additional Context <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value.slice(0, 1000))}
                placeholder="Medical history, medications, recent travel, family history, allergies..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none h-24 text-slate-700"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{context.length}/1000</p>
            </div>

            {/* Emergency Banner */}
            {emergencyWarning && (
              <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0 animate-pulse" />
                <div>
                  <p className="text-sm font-bold text-red-700 mb-0.5">Potential Emergency Detected</p>
                  <p className="text-sm text-red-700">{emergencyWarning}</p>
                  <p className="text-xs text-red-500 mt-1">If experiencing this now — do not wait, seek emergency care.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={selectedSymptoms.length === 0}
              className={clsx(
                "w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                selectedSymptoms.length === 0
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md"
              )}
            >
              <Stethoscope className="w-4 h-4" />
              Analyze Symptoms
              <ChevronRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-400 text-center">Educational purposes only — not a substitute for professional medical care.</p>
          </div>

          {/* RIGHT: Empty state */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center h-full flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 bg-purple-50 rounded-2xl flex items-center justify-center">
                <Stethoscope className="w-10 h-10 text-purple-300" />
              </div>
              <div>
                <p className="text-slate-700 font-semibold text-lg">Your clinical analysis will appear here</p>
                <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">Use the body map or tabs on the left, then click Analyze.</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-sm text-left">
                {[
                  { icon: "🗺️", text: "Interactive body map to select symptoms" },
                  { icon: "🚨", text: "Real-time red flag & emergency detection" },
                  { icon: "🩺", text: "ICD-10 differential diagnosis" },
                  { icon: "⚡", text: "4-tier clinical triage & urgency" },
                  { icon: "📋", text: "Personalized action plan & specialist referral" },
                  { icon: "💬", text: "Follow-up chat to ask questions about your results" },
                  { icon: "📄", text: "Export PDF report to share with your doctor" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-600">
                    <span>{icon}</span>{text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTS ────────────────────────────────────────────────────────────── */}
      {!showForm && (
        <div className="space-y-4">
          {/* Results header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-slate-900">
                  Analysis:{" "}
                  <span className="text-purple-700">
                    {selectedSymptoms.slice(0, 3).join(", ")}
                    {selectedSymptoms.length > 3 ? ` +${selectedSymptoms.length - 3} more` : ""}
                  </span>
                </h2>
                {urgencyLevel && (
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full font-semibold border", URGENCY_STYLES[urgencyLevel]?.cls || URGENCY_STYLES.routine.cls)}>
                    {URGENCY_STYLES[urgencyLevel]?.label || "Routine"}
                  </span>
                )}
              </div>
              {(duration || severity || age || sex) && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {[duration, severity && `${severity} severity`, age && `Age ${age}`, sex].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            {done && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  className="text-sm text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-lg transition-colors"
                  title="Export PDF report"
                >
                  <FileText className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={reset}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1.5 border border-purple-200 hover:border-purple-300 px-3 py-2 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  New Analysis
                </button>
              </div>
            )}
          </div>

          {/* Loading skeleton */}
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
              <p className="font-semibold text-slate-800">Connecting to AI clinical engine...</p>
              <p className="text-slate-400 text-sm">Retrieving medical knowledge base</p>
            </div>
          )}

          {/* Streaming progress bar */}
          {streaming && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin flex-shrink-0" />
              <span className="text-xs text-purple-700 font-medium">{currentSection}</span>
              <div className="ml-auto flex gap-1">
                {SECTIONS.map((s) => (
                  <div
                    key={s.keyword}
                    className={clsx("h-1.5 w-8 rounded-full transition-all duration-500", aiText.includes(s.keyword) ? "bg-purple-500" : "bg-purple-200")}
                  />
                ))}
              </div>
            </div>
          )}

          {/* AI Response */}
          {aiText && <AIResponse text={aiText} isStreaming={!done} title="Clinical Assessment" />}

          {/* Disclaimer */}
          {done && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                This AI-generated analysis is for educational purposes only and does not constitute a medical diagnosis.
                Always consult a licensed healthcare provider before making any health decisions.
              </p>
            </div>
          )}

          {/* ── Follow-up Chat ──────────────────────────────────────────────── */}
          {done && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-slate-200 px-5 py-3.5 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-slate-800 text-sm">Ask a Follow-up Question</span>
                <span className="text-xs text-slate-500 ml-1">— ask about any part of your analysis</span>
              </div>

              {/* Message history */}
              {chatMessages.length > 0 && (
                <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={clsx(
                          "max-w-[80%] text-sm px-4 py-2.5 rounded-2xl",
                          msg.role === "user"
                            ? "bg-purple-600 text-white rounded-tr-sm"
                            : "bg-slate-100 text-slate-800 rounded-tl-sm"
                        )}
                      >
                        {msg.role === "assistant" && msg.streaming ? (
                          <span>{msg.content}<span className="inline-block w-1 h-4 bg-slate-400 ml-0.5 animate-pulse rounded" /></span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
              )}

              {/* Chat suggestions */}
              {chatMessages.length === 0 && (
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {[
                    "What does the differential diagnosis mean?",
                    "Which doctor should I see first?",
                    "What tests should I ask for?",
                    "Is this serious?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setChatInput(q)}
                      className="text-xs border border-purple-200 text-purple-600 px-3 py-1.5 rounded-full hover:bg-purple-50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat input */}
              <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSubmit()}
                  placeholder="Ask about your results..."
                  disabled={chatLoading}
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={!chatInput.trim() || chatLoading}
                  className={clsx(
                    "p-2.5 rounded-xl transition-colors",
                    !chatInput.trim() || chatLoading
                      ? "bg-slate-100 text-slate-300"
                      : "bg-purple-600 hover:bg-purple-700 text-white"
                  )}
                >
                  {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
