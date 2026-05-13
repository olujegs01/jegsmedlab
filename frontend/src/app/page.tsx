import Link from "next/link";
import type { Metadata } from "next";
import { FlaskConical, Activity } from "lucide-react";

export const metadata: Metadata = {
  title: "JegsMed — AI-Powered Medical Platform",
  description:
    "JegsMed brings together AI lab result analysis and emergency department triage in one unified platform. Powered by Claude AI.",
  keywords: "JegsMed, lab results AI, ED triage, emergency department, medical AI, health platform",
  openGraph: {
    title: "JegsMed — AI-Powered Medical Platform",
    description: "Lab AI + Emergency Department Gateway, unified under one platform.",
    type: "website",
  },
};

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-900/40">
          <span className="text-white text-2xl">⚕</span>
        </div>
        <span className="text-3xl font-bold text-white tracking-tight">JegsMed</span>
      </div>
      <p className="text-slate-400 text-base mb-16 text-center max-w-sm">
        AI-powered medical intelligence platform — choose your workspace below
      </p>

      {/* Two entry cards */}
      <div className="grid sm:grid-cols-2 gap-6 w-full max-w-3xl">

        {/* MedLab card */}
        <Link href="/app" className="group block">
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-8 hover:border-blue-500/60 hover:bg-slate-800/80 transition-all duration-200 hover:shadow-2xl hover:shadow-blue-900/30 cursor-pointer h-full">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-900/40 group-hover:scale-105 transition-transform">
              <FlaskConical className="w-7 h-7 text-white" />
            </div>
            <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 text-xs font-semibold text-blue-400 mb-3">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
              Consumer Health AI
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">MedLab</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Upload any lab report and get instant AI-powered interpretations in plain English.
              Symptom checking, trend analysis, and personalized health insights.
            </p>
            <ul className="space-y-2 mb-8">
              {["Lab report analysis (PDF / image)", "AI symptom checker", "Health trend tracking", "Ask AI — unlimited questions"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3 px-6 text-center transition-colors text-sm">
              Enter MedLab →
            </div>
          </div>
        </Link>

        {/* MediScan Gateway card */}
        <Link href="/ed" className="group block">
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-8 hover:border-teal-500/60 hover:bg-slate-800/80 transition-all duration-200 hover:shadow-2xl hover:shadow-teal-900/30 cursor-pointer h-full">
            <div className="w-14 h-14 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-teal-900/40 group-hover:scale-105 transition-transform">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <div className="inline-flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/20 rounded-full px-3 py-1 text-xs font-semibold text-teal-400 mb-3">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
              Clinical Operations
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">MediScan Gateway</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Emergency department AI triage platform. Walk-through sensor portal, real-time queue
              management, bed board, SOAP notes, and clinical journeys.
            </p>
            <ul className="space-y-2 mb-8">
              {["AI patient scanner — ESI triage in &lt;15s", "Live ER queue + bed board", "Shift reports & HIPAA audit log", "CareNavigator pre-arrival triage"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="w-4 h-4 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full" />
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: f }} />
                </li>
              ))}
            </ul>
            <div className="bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl py-3 px-6 text-center transition-colors text-sm">
              Enter MediScan Gateway →
            </div>
          </div>
        </Link>
      </div>

      {/* CareNavigator quick link */}
      <p className="mt-10 text-slate-600 text-sm">
        Public symptom triage?{" "}
        <Link href="/ed/care-navigator" className="text-teal-400 hover:text-teal-300 underline underline-offset-2">
          Open CareNavigator
        </Link>
      </p>

      <p className="mt-6 text-slate-700 text-xs">© 2025 JegsMed · For educational use only</p>
    </div>
  );
}
