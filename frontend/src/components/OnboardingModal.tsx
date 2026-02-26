"use client";

import { useState, useEffect } from "react";
import { Upload, Activity, TrendingUp, MessageCircle, X, ChevronRight, FlaskConical, CheckCircle } from "lucide-react";
import clsx from "clsx";

const STEPS = [
  {
    icon: FlaskConical,
    color: "from-blue-500 to-indigo-600",
    title: "Welcome to MedLab AI",
    subtitle: "Your personal health intelligence platform",
    content: "MedLab AI uses Claude Opus 4.6 AI with medical knowledge from NIH, PubMed, and FDA to help you understand your health data in plain English.",
    cta: "Let's get started",
  },
  {
    icon: Upload,
    color: "from-blue-500 to-blue-600",
    title: "Upload Your Lab Reports",
    subtitle: "Step 1 of 3",
    content: "Drag and drop any lab report PDF, image, or scanned document. Our AI reads Quest, LabCorp, and all major lab formats — and explains every value.",
    cta: "Next",
  },
  {
    icon: Activity,
    color: "from-purple-500 to-purple-600",
    title: "Check Your Symptoms",
    subtitle: "Step 2 of 3",
    content: "Describe your symptoms and get a doctor-style differential analysis with recommended lab tests and urgency level — in seconds.",
    cta: "Next",
  },
  {
    icon: TrendingUp,
    color: "from-teal-500 to-teal-600",
    title: "Track Your Health Over Time",
    subtitle: "Step 3 of 3",
    content: "See how your lab values trend over months. Spot what's improving and what needs attention. Ask AI follow-up questions anytime.",
    cta: "Start Using MedLab AI",
  },
];

export default function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem("medlab_onboarded");
    if (!seen) {
      setTimeout(() => setOpen(true), 800);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem("medlab_onboarded", "true");
    setOpen(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Close */}
          <div className="flex justify-end mb-2">
            <button onClick={dismiss} className="text-slate-300 hover:text-slate-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Icon */}
          <div className={`w-16 h-16 bg-gradient-to-br ${current.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
            <Icon className="w-8 h-8 text-white" />
          </div>

          {/* Content */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{current.subtitle}</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">{current.title}</h2>
          <p className="text-slate-500 leading-relaxed mb-8">{current.content}</p>

          {/* Dots */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={clsx(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6 bg-blue-600" : i < step ? "w-2 bg-blue-300" : "w-2 bg-slate-200"
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={next}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {current.cta}
              {step < STEPS.length - 1 ? <ChevronRight className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            </button>
            {step > 0 && (
              <button onClick={dismiss} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
