"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useEDAuth, ED_API } from "@/contexts/EDAuthContext";

const MODULES = [
  { icon: "📡", tag: "Module", title: "Walk-Through Triage Scanner", desc: "Patients walk through a sensor portal and receive ESI-scored triage in under 15 seconds — no forms, no waiting room delays.", stat1: { val: "<15s", label: "Door-to-Triage" }, stat2: { val: "28 min", label: "National Avg", muted: true }, bullets: ["mmWave radar, thermal IR, and LiDAR vitals capture", "AI ESI classification with sepsis & behavioral health flags", "Epic/EHR pre-staged orders before patient reaches the bed"] },
  { icon: "🩺", tag: "Module", title: "AI CareNavigator", desc: "Conversational AI triage that routes patients to the right care level before they arrive — reducing unnecessary ED visits.", stat1: { val: "67%", label: "Diversion Rate" }, stat2: { val: "$1,850", label: "Avg Visit Cost Saved", muted: true }, bullets: ["7-tier routing: 911, ER, Urgent Care, Telehealth, Primary, Self-Care", "Clinical scores: HEART, Wells, FAST, Ottawa, ABCD², PECARN", "Appointment booking with iCal confirmation"] },
  { icon: "📋", tag: "Module", title: "AI Clinical Intake & SOAP Notes", desc: "AI generates structured SOAP notes from triage data at discharge, ready for physician review and sign-off in seconds.", stat1: { val: "94%", label: "Documentation Accuracy" }, stat2: { val: "<30s", label: "Note Generation Time", muted: true }, bullets: ["Subjective, Objective, Assessment, Plan auto-generated", "Physician finalization with one click", "HIPAA-compliant audit trail on every note"] },
  { icon: "🔄", tag: "Module", title: "Clinical Journeys™", desc: "Post-discharge follow-up automation that monitors patients via SMS and escalates deteriorating cases before they become readmissions.", stat1: { val: "85%", label: "Journey Completion" }, stat2: { val: "$14,500", label: "Avg Readmission Cost Averted", muted: true }, bullets: ["ESI-tiered check-in schedule (24h, 48h, 72h, 7d)", "Keyword-based deterioration detection with auto-escalation", "Real-time staff alerts via WebSocket and SMS"] },
  { icon: "📊", tag: "Module", title: "Outcomes Command Dashboard", desc: "Real-time analytics suite benchmarked against national ED standards — the ROI proof hospitals need before signing.", stat1: { val: "30s", label: "Auto-Refresh Interval" }, stat2: { val: "5+", label: "Live Chart Types", muted: true }, bullets: ["Sepsis bundle compliance vs national benchmarks", "CareNavigator diversion funnel with cost savings", "7-day ESI trends, LOS, LWBS, and capacity heatmap"] },
  { icon: "🛡", tag: "Module", title: "Enterprise Compliance Center", desc: "HIPAA technical safeguards, BAA generation, escalation rule engine, and SOC 2 Type II controls — ready for enterprise procurement.", stat1: { val: "100%", label: "HIPAA Controls Met" }, stat2: { val: "7 yr", label: "Data Retention Policy", muted: true }, bullets: ["14-point HIPAA control checklist with live status", "One-click BAA PDF generation (reportlab)", "Configurable escalation rules with response-time SLAs"] },
];

function ModuleCard({ mod }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lp-module-card">
      <div className="lp-module-tag"><span className="lp-tag-dot" />Module</div>
      <div className="lp-module-icon">{mod.icon}</div>
      <div className="lp-module-title">{mod.title}</div>
      <div className="lp-module-desc">{mod.desc}</div>
      <div className="lp-module-stats">
        <div className="lp-stat"><div className="lp-stat-val">{mod.stat1.val}</div><div className="lp-stat-label">{mod.stat1.label}</div></div>
        <div className="lp-stat muted"><div className="lp-stat-val">{mod.stat2.val}</div><div className="lp-stat-label">{mod.stat2.label}</div></div>
      </div>
      <button className="lp-module-toggle" onClick={() => setOpen((o: boolean) => !o)}>{open ? "Hide capabilities ↑" : "Show capabilities ↓"}</button>
      {open && (
        <ul className="lp-capabilities">
          {mod.bullets.map((b: string, i: number) => (<li key={i}><span className="lp-bullet-dot" />{b}</li>))}
        </ul>
      )}
    </div>
  );
}

export default function EDLoginPage() {
  const { login, loginWithToken } = useEDAuth();
  const [stats, setStats] = useState<any>(null);
  const [form, setForm] = useState({ username: "", password: "", totp_code: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const modulesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${ED_API}/stats`).then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = await login(form.username, form.password, mfaRequired ? form.totp_code : undefined);
      if (result?.mfa_required && !mfaRequired) setMfaRequired(true);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true); setError("");
    try {
      const res = await fetch(`${ED_API}/auth/demo-login`, { method: "POST" });
      const data = await res.json();
      if (data.access_token) { loginWithToken(data.access_token); }
      else { setError("Demo login unavailable — please use credentials below."); }
    } catch { setError("Network error. Please try again."); }
    finally { setDemoLoading(false); }
  };

  return (
    <div className="lp-root">
      {/* Top nav */}
      <nav className="lp-nav">
        <div className="lp-nav-brand">
          <span className="lp-nav-icon">⚕</span>
          <span className="lp-nav-name">MediScan</span>
          <span className="lp-nav-badge">Gateway v2</span>
        </div>
        <div className="lp-nav-links">
          <a href="#modules" onClick={e => { e.preventDefault(); modulesRef.current?.scrollIntoView({ behavior: "smooth" }); }}>Platform</a>
          <a href="/ed/care-navigator" target="_blank" rel="noopener noreferrer">CareNavigator</a>
          <a href="/ed/lobby" target="_blank" rel="noopener noreferrer">Lobby Display</a>
          <a href="/" style={{ color: "#5eead4" }}>← JegsMed Home</a>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="#login" className="lp-nav-cta" onClick={e => { e.preventDefault(); document.getElementById("lp-login-form")?.scrollIntoView({ behavior: "smooth" }); }}>Sign In →</a>
        </div>
      </nav>

      {/* Hero */}
      <div className="lp-hero">
        <div className="lp-hero-left">
          <div className="lp-hero-pill">AI-Native Emergency Triage Platform</div>
          <h1 className="lp-hero-headline">The MediScan<br /><span className="lp-headline-teal">Gateway</span> Platform</h1>
          <p className="lp-hero-sub">Six AI-native modules that unify walk-through triage, symptom routing, clinical documentation, post-discharge monitoring, and outcomes analytics into one seamless patient access platform.</p>

          <div className="lp-hero-stats">
            {[
              [stats?.patients_triaged?.toLocaleString() ?? "3,847+", "Patients Triaged"],
              [stats ? `${stats.ai_accuracy_pct}%` : "95.3%", "AI Accuracy"],
              [stats ? `${stats.door_to_triage_seconds_avg}s` : "14s", "Door-to-Triage"],
              [stats ? `${stats.uptime_pct}%` : "99.97%", "Uptime SLA"],
            ].map(([val, label]) => (
              <div key={label} className="lp-hero-stat"><div className="lp-hero-stat-val">{val}</div><div className="lp-hero-stat-label">{label}</div></div>
            ))}
          </div>

          <div className="lp-trust-badges">
            {["✓ HIPAA Compliant", "✓ BAA Available", "✓ SOC 2 In Progress", "🔒 E2E Encrypted"].map(b => (<span key={b} className="lp-trust-badge">{b}</span>))}
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            <a href="#modules" className="lp-hero-cta-secondary" onClick={e => { e.preventDefault(); modulesRef.current?.scrollIntoView({ behavior: "smooth" }); }}>See Platform ↓</a>
          </div>
        </div>

        {/* Login card */}
        <div className="lp-hero-right" id="lp-login-form">
          <div className="lp-login-card">
            <h2 className="lp-login-title">Sign In</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input placeholder="admin / nurse / physician" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoComplete="username" disabled={loading} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" placeholder="Enter password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} autoComplete="current-password" disabled={loading} />
              </div>
              {mfaRequired && (
                <div className="form-group">
                  <label>Authenticator Code</label>
                  <input type="text" placeholder="6-digit code" value={form.totp_code} onChange={e => setForm(f => ({ ...f, totp_code: e.target.value }))} maxLength={6} autoComplete="one-time-code" autoFocus disabled={loading} style={{ letterSpacing: "0.3em", fontSize: 20, textAlign: "center" }} />
                </div>
              )}
              {error && <div className="login-error">{error}</div>}
              <button type="submit" className="scan-btn" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
                {loading ? <><span className="btn-spinner" /> Signing in…</> : mfaRequired ? "Verify Code →" : "Sign In →"}
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 12px" }}>
              <div style={{ flex: 1, height: 1, background: "#1e293b" }} />
              <span style={{ fontSize: 11, color: "#475569" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#1e293b" }} />
            </div>

            <button onClick={handleDemoLogin} disabled={demoLoading} style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "transparent", border: "1px solid #0d9488", color: "#5eead4", fontSize: 13, fontWeight: 600, cursor: demoLoading ? "not-allowed" : "pointer", marginBottom: 16, transition: "all 0.2s" }}>
              {demoLoading ? "Loading demo…" : "▶ Try Live Demo — no login required"}
            </button>

            <div className="lp-demo-creds">
              <div className="lp-creds-label">Demo credentials</div>
              {[["admin", "mediscan2026"], ["nurse", "nurse2026"], ["physician", "physician2026"]].map(([u, p]) => (
                <div key={u} className="lp-cred-row">
                  <code className="lp-cred-user">{u}</code>
                  <code className="lp-cred-pass">{p}</code>
                  <button className="lp-cred-fill" onClick={() => setForm(f => ({ ...f, username: u, password: p }))}>Fill</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Platform modules */}
      <div className="lp-modules-section" ref={modulesRef}>
        <div className="lp-modules-pill"><span className="lp-tag-dot" style={{ background: "#0d9488" }} />Platform modules</div>
        <h2 className="lp-modules-headline">The MediScan platform</h2>
        <p className="lp-modules-sub">Six AI-native modules that unify triage, routing, documentation, follow-up, and analytics into one seamless ED platform.</p>
        <div className="lp-modules-grid">{MODULES.map(mod => <ModuleCard key={mod.title} mod={mod} />)}</div>
      </div>

      {/* Outcomes strip */}
      <div className="lp-outcomes-strip">
        {[["<15s", "Door-to-Triage", "vs 28 min national avg"],["60%", "LWBS Reduction", "left without being seen"],["94%", "Sepsis Detection", "vs 60% national avg"],["$14.5k", "Readmission Cost Averted", "per escalated journey"],["67%", "ED Diversion Rate", "via CareNavigator routing"],["99.97%", "Platform Uptime", "SLA guaranteed"]].map(([val, label, sub]) => (
          <div key={label} className="lp-outcome-item"><div className="lp-outcome-val">{val}</div><div className="lp-outcome-label">{label}</div><div className="lp-outcome-sub">{sub}</div></div>
        ))}
      </div>

      <footer className="lp-footer">
        <span>⚕ MediScan Gateway v2</span>
        <span>Part of JegsMed Platform</span>
        <span>HIPAA · BAA · SOC 2</span>
      </footer>
    </div>
  );
}
