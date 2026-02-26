"use client";

import { useState, useEffect } from "react";
import type { Tab } from "@/types";
import {
  Activity, Upload, MessageCircle, TrendingUp,
  AlertTriangle, CheckCircle, AlertCircle, Zap,
  FlaskConical, Heart, Brain, Shield
} from "lucide-react";
import clsx from "clsx";
import KnowledgeStats from "./KnowledgeStats";

interface Stats {
  total_reports: number;
  total_values: number;
  critical_count: number;
  concerning_count: number;
  normal_count: number;
  last_report_date: string | null;
  overall_health_score: number | null;
}

interface DashboardProps {
  setActiveTab: (tab: Tab) => void;
  patientId?: string;
}

const features = [
  {
    icon: Upload,
    title: "Lab Report Analysis",
    desc: "Upload PDF or image reports — AI extracts and interprets every value in plain English.",
    tab: "upload" as Tab,
    color: "from-blue-500 to-blue-600",
    badge: "AI-Powered",
  },
  {
    icon: Activity,
    title: "Symptom Checker",
    desc: "Describe your symptoms and get a differential analysis with recommended lab tests.",
    tab: "symptoms" as Tab,
    color: "from-purple-500 to-purple-600",
    badge: "RAG-Enhanced",
  },
  {
    icon: TrendingUp,
    title: "Trend Analysis",
    desc: "Track your lab values over time with interactive charts and AI narrative insights.",
    tab: "trends" as Tab,
    color: "from-teal-500 to-teal-600",
    badge: "Longitudinal",
  },
  {
    icon: MessageCircle,
    title: "Ask AI Anything",
    desc: "Have a conversation about your results — ask follow-up questions anytime.",
    tab: "ask" as Tab,
    color: "from-emerald-500 to-emerald-600",
    badge: "Conversational",
  },
];

const platformFeatures = [
  { icon: FlaskConical, label: "Lab Decoding", desc: "Like MedDecode AI" },
  { icon: Heart, label: "Health Insights", desc: "Like LabSense Health" },
  { icon: Brain, label: "Smart Analysis", desc: "Like ClearLab AI" },
  { icon: Shield, label: "Safe Guidance", desc: "Like Wizey Health" },
];

export default function Dashboard({ setActiveTab, patientId = "demo-patient" }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard-stats?patient_id=${patientId}`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const healthColor =
    stats?.overall_health_score == null
      ? "text-slate-400"
      : stats.overall_health_score >= 80
      ? "text-emerald-600"
      : stats.overall_health_score >= 60
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 rounded-2xl p-8 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-200 text-sm font-medium mb-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            AI System Online · Claude Opus 4.6 · RAG-Enhanced
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Your Personal Health Intelligence Platform
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl">
            Upload lab reports, describe symptoms, and get instant AI-powered interpretations
            with clinical context — all in plain English.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => setActiveTab("upload")}
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Analyze My Labs
            </button>
            <button
              onClick={() => setActiveTab("symptoms")}
              className="bg-blue-500/30 hover:bg-blue-500/40 text-white font-semibold px-6 py-3 rounded-xl transition-all flex items-center gap-2 border border-white/20"
            >
              <Activity className="w-4 h-4" />
              Check Symptoms
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {!loading && stats && stats.total_reports > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Reports Analyzed"
            value={stats.total_reports}
            icon={FlaskConical}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            label="Health Score"
            value={stats.overall_health_score != null ? `${stats.overall_health_score}%` : "—"}
            icon={Heart}
            color={clsx("bg-emerald-50", healthColor)}
            valueClass={healthColor}
          />
          <StatCard
            label="Abnormal Values"
            value={stats.concerning_count + stats.critical_count}
            icon={AlertTriangle}
            color="bg-amber-50 text-amber-600"
            alert={stats.critical_count > 0}
          />
          <StatCard
            label="Normal Values"
            value={stats.normal_count}
            icon={CheckCircle}
            color="bg-emerald-50 text-emerald-600"
          />
        </div>
      )}

      {/* Critical Alert */}
      {stats && stats.critical_count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">
              {stats.critical_count} critical value{stats.critical_count > 1 ? "s" : ""} detected
            </p>
            <p className="text-red-700 text-sm mt-0.5">
              Please review your latest lab report and consult your healthcare provider as soon as possible.
            </p>
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">What JegsMedLab Can Do</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.tab}
                onClick={() => setActiveTab(f.tab)}
                className="group text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all duration-200"
              >
                <div
                  className={clsx(
                    "w-10 h-10 bg-gradient-to-br rounded-xl flex items-center justify-center mb-4 shadow-sm",
                    f.color
                  )}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                    {f.title}
                  </h3>
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-medium">
                    {f.badge}
                  </span>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Knowledge Base Status */}
      <KnowledgeStats />

      {/* Platform Equivalence */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-bold text-slate-900">
            All-In-One Platform — Replaces Multiple Apps
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {platformFeatures.map((pf) => {
            const Icon = pf.icon;
            return (
              <div key={pf.label} className="flex flex-col items-center text-center p-4 bg-slate-50 rounded-xl">
                <Icon className="w-6 h-6 text-blue-600 mb-2" />
                <p className="font-semibold text-slate-800 text-sm">{pf.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{pf.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-center text-xs text-slate-400">
          Combines features from Wizey Health · Kantesti · TestResult · LabSense Health · ClearLab AI · MedDecode
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-6">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "Upload Your Report",
              desc: "Drag & drop any lab report PDF, image, or scanned document. Our AI reads it all.",
              color: "bg-blue-600",
            },
            {
              step: "2",
              title: "AI Analyzes & Interprets",
              desc: "Claude Opus 4.6 with RAG retrieval interprets each value with clinical context.",
              color: "bg-indigo-600",
            },
            {
              step: "3",
              title: "Get Clear Insights",
              desc: "Receive plain-English explanations, risk flags, trends, and actionable next steps.",
              color: "bg-purple-600",
            },
          ].map((s) => (
            <div key={s.step} className="flex gap-4">
              <div
                className={clsx(
                  "w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0",
                  s.color
                )}
              >
                {s.step}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm mb-1">{s.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  valueClass,
  alert,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  valueClass?: string;
  alert?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-4 h-4" />
        </div>
        {alert && (
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>
      <p className={clsx("text-2xl font-bold", valueClass || "text-slate-900")}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
