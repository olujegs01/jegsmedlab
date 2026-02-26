import Link from "next/link";
import type { Metadata } from "next";
import {
  Upload, Activity, TrendingUp, MessageCircle,
  Shield, Zap, CheckCircle, Star, ArrowRight,
  FlaskConical, Brain, Heart, Lock, RefreshCw, FileText
} from "lucide-react";

export const metadata: Metadata = {
  title: "MedLab AI — Understand Your Lab Results in Plain English",
  description: "Upload your lab reports and get instant AI-powered interpretations, symptom analysis, trend tracking, and personalized health insights. Powered by Claude AI.",
  keywords: "lab results, blood test interpreter, AI health, symptom checker, medical AI",
  openGraph: {
    title: "MedLab AI — Understand Your Lab Results in Plain English",
    description: "AI-powered lab result interpretation. Upload, analyze, and understand your health data.",
    type: "website",
  },
};

const features = [
  {
    icon: Upload,
    title: "Lab Report Analysis",
    desc: "Upload any PDF or image lab report. Our AI extracts every value and explains it in plain English — no medical degree required.",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: Activity,
    title: "Symptom Checker",
    desc: "Describe your symptoms and receive a doctor-style differential analysis with recommended lab tests and next steps.",
    color: "text-purple-600 bg-purple-50",
  },
  {
    icon: TrendingUp,
    title: "Trend Analysis",
    desc: "Track your lab values over time with interactive charts. See what's improving, what's worsening, and why it matters.",
    color: "text-teal-600 bg-teal-50",
  },
  {
    icon: MessageCircle,
    title: "Ask AI Anything",
    desc: "Have a real conversation about your results. Ask follow-up questions and get clear, medically-grounded answers.",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: FileText,
    title: "PDF Reports",
    desc: "Export a clean, professional summary of your lab results to share with your doctor or keep for your records.",
    color: "text-indigo-600 bg-indigo-50",
  },
  {
    icon: RefreshCw,
    title: "Auto-Updated Knowledge",
    desc: "Our AI knowledge base pulls daily from NIH MedlinePlus, PubMed, and FDA — always current with medical research.",
    color: "text-amber-600 bg-amber-50",
  },
];

const steps = [
  {
    step: "01",
    title: "Upload Your Report",
    desc: "Drag and drop any lab report PDF, image, or scanned document. We read them all.",
    color: "bg-blue-600",
  },
  {
    step: "02",
    title: "AI Analyzes & Interprets",
    desc: "Claude AI with medical RAG retrieval interprets every value with clinical context and reference ranges.",
    color: "bg-indigo-600",
  },
  {
    step: "03",
    title: "Get Clear Insights",
    desc: "Receive plain-English explanations, risk flags, trend analysis, and actionable next steps.",
    color: "bg-purple-600",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for occasional lab checks",
    features: [
      "3 lab report uploads/month",
      "AI symptom checker",
      "Ask AI (10 questions/month)",
      "Basic trend tracking",
    ],
    cta: "Get Started Free",
    href: "/app",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    desc: "For people serious about their health",
    features: [
      "Unlimited lab report uploads",
      "Unlimited AI questions",
      "Full trend history & charts",
      "PDF export & doctor share",
      "Email alerts for critical values",
      "Priority AI processing",
    ],
    cta: "Start Pro — $12/mo",
    href: "/app?upgrade=true",
    highlight: true,
  },
];

const testimonials = [
  {
    quote: "I finally understand what my doctor has been trying to tell me for years. MedLab AI explained my thyroid results better than any pamphlet.",
    name: "Sarah K.",
    role: "Managing Hashimoto's disease",
    avatar: "SK",
  },
  {
    quote: "Uploaded my CBC after my checkup and got a full breakdown in 30 seconds. Flagged my low ferritin before I even asked about fatigue.",
    name: "Marcus T.",
    role: "Marathon runner",
    avatar: "MT",
  },
  {
    quote: "As someone with diabetes, tracking my HbA1c trends over months is invaluable. The AI narrative actually motivates me to stay on track.",
    name: "Priya N.",
    role: "Type 2 diabetes management",
    avatar: "PN",
  },
];

const trustBadges = [
  { icon: Shield, label: "HIPAA-aware design" },
  { icon: Lock, label: "Data never sold" },
  { icon: Brain, label: "Claude Opus 4.6 AI" },
  { icon: FlaskConical, label: "NIH + PubMed data" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">MedLab AI</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
              Sign In
            </Link>
            <Link
              href="/app"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Powered by Claude Opus 4.6 · RAG-Enhanced Medical AI
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-6">
              Understand Your Lab Results in Plain English
            </h1>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl leading-relaxed">
              Upload any lab report and get instant AI-powered interpretations, symptom analysis,
              and personalized health insights — like having a doctor friend who explains everything clearly.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/app"
                className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-8 py-4 rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-xl text-lg"
              >
                <Upload className="w-5 h-5" />
                Analyze My Labs Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/app?tab=symptoms"
                className="bg-blue-500/30 hover:bg-blue-500/40 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-all flex items-center gap-2 text-lg"
              >
                <Activity className="w-5 h-5" />
                Check Symptoms
              </Link>
            </div>
            <p className="mt-4 text-blue-200 text-sm">No credit card required · Results in seconds</p>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-b border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {trustBadges.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.label} className="flex items-center gap-2 justify-center">
                  <Icon className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-600">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Everything You Need to Own Your Health
          </h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            MedLab AI combines six powerful tools into one platform — replacing apps like
            MedDecode, LabSense, ClearLab, and Wizey Health.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md hover:border-blue-200 transition-all">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-slate-500 text-lg">From upload to insight in under 60 seconds.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.step} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-8 left-[60%] w-full h-0.5 bg-slate-200 z-0" />
                )}
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className={`w-16 h-16 ${s.color} rounded-2xl flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg`}>
                    {s.step}
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">{s.title}</h3>
                  <p className="text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/app" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl inline-flex items-center gap-2 transition-colors shadow-md">
              Try It Now — Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Trusted by Health-Conscious People</h2>
          <div className="flex items-center justify-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <p className="text-slate-500">Rated 4.9/5 by early users</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-slate-700 leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-500 text-lg">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.highlight
                    ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-2xl scale-105"
                    : "bg-white border border-slate-200"
                }`}
              >
                {plan.highlight && (
                  <div className="text-xs font-bold bg-white/20 border border-white/30 rounded-full px-3 py-1 inline-block mb-4">
                    MOST POPULAR
                  </div>
                )}
                <h3 className={`text-xl font-bold mb-1 ${plan.highlight ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-4xl font-bold ${plan.highlight ? "text-white" : "text-slate-900"}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? "text-blue-200" : "text-slate-400"}`}>/{plan.period}</span>
                </div>
                <p className={`text-sm mb-6 ${plan.highlight ? "text-blue-100" : "text-slate-500"}`}>{plan.desc}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? "text-green-300" : "text-emerald-500"}`} />
                      <span className={`text-sm ${plan.highlight ? "text-blue-50" : "text-slate-600"}`}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block text-center font-bold py-3 rounded-xl transition-all ${
                    plan.highlight
                      ? "bg-white text-blue-700 hover:bg-blue-50"
                      : "bg-slate-900 text-white hover:bg-slate-700"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-12 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Understand Your Health?</h2>
          <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
            Join thousands of people who use MedLab AI to take control of their health data.
          </p>
          <Link
            href="/app"
            className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-10 py-4 rounded-xl inline-flex items-center gap-2 transition-all shadow-lg text-lg"
          >
            Get Started — It&apos;s Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-blue-200 text-sm">No credit card required · Results in seconds</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                  <FlaskConical className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-slate-900">MedLab AI</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                AI-powered health intelligence platform. Understand your lab results in plain English.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm mb-3">Product</p>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-blue-600 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a></li>
                <li><Link href="/app" className="hover:text-blue-600 transition-colors">App</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm mb-3">Use Cases</p>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><span>Lab Report Analysis</span></li>
                <li><span>Symptom Checker</span></li>
                <li><span>Health Trend Tracking</span></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm mb-3">Legal</p>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><span>Privacy Policy</span></li>
                <li><span>Terms of Service</span></li>
                <li><span>HIPAA Notice</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <p>© 2025 MedLab AI. All rights reserved.</p>
            <p>For educational purposes only. Not a substitute for professional medical advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
