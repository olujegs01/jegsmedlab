"use client";

import { useState, useEffect, useCallback } from "react";
import { useEDAuth, ED_API } from "@/contexts/EDAuthContext";

const ESI_CFG: Record<number, { color: string; bg: string; label: string; icon: string }> = {
  1: { color: "#dc2626", bg: "rgba(220,38,38,0.10)", label: "CRITICAL",    icon: "🚨" },
  2: { color: "#ea580c", bg: "rgba(234,88,12,0.10)",  label: "HIGH ACUITY", icon: "🔴" },
  3: { color: "#ca8a04", bg: "rgba(202,138,4,0.10)",  label: "URGENT",      icon: "🟡" },
  4: { color: "#16a34a", bg: "rgba(22,163,74,0.10)",  label: "LESS URGENT", icon: "🟢" },
  5: { color: "#6b7280", bg: "rgba(107,114,128,0.10)",label: "NON-URGENT",  icon: "⚪" },
};

const DIFF: Record<string, { color: string; bg: string }> = {
  easy:   { color: "#4ade80", bg: "rgba(74,222,128,0.10)" },
  medium: { color: "#fbbf24", bg: "rgba(251,191,36,0.10)" },
  hard:   { color: "#f87171", bg: "rgba(248,113,113,0.10)" },
};

interface Scenario {
  id: string; name: string; chief_complaint: string;
  vitals: Record<string, number>; history: string[]; medications: string[];
  presentation_note: string; difficulty: string;
}

interface Result {
  correct: boolean; correct_esi: number; your_esi: number;
  score: number; speed_bonus: number; reasoning: string;
  teaching_points: string[]; esi_label: string;
}

export default function TrainingMode() {
  const { user } = useEDAuth();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [order, setOrder] = useState<Scenario[]>([]);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${ED_API}/training/scenarios`)
      .then(r => r.json())
      .then((data: Scenario[]) => {
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setScenarios(data);
        setOrder(shuffled);
        setLoading(false);
        setStartTime(Date.now());
      })
      .catch(() => setLoading(false));
  }, []);

  const scenario = order[idx];

  const handleSubmit = useCallback(async () => {
    if (!pick || !scenario || submitting) return;
    setSubmitting(true);
    const elapsed = (Date.now() - startTime) / 1000;
    try {
      const token = localStorage.getItem("mediscan_token");
      const res = await fetch(`${ED_API}/training/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scenario_id: scenario.id, selected_esi: pick, response_time_seconds: elapsed }),
      });
      const data: Result = await res.json();
      setResult(data);
      setTotalScore(s => s + data.score);
      setAnswered(a => a + 1);
    } catch {}
    finally { setSubmitting(false); }
  }, [pick, scenario, submitting, startTime]);

  const handleNext = useCallback(() => {
    if (idx + 1 >= order.length) { setDone(true); return; }
    setIdx(i => i + 1);
    setPick(null);
    setResult(null);
    setStartTime(Date.now());
  }, [idx, order.length]);

  const restart = () => {
    const s = [...scenarios].sort(() => Math.random() - 0.5);
    setOrder(s); setIdx(0); setPick(null); setResult(null);
    setTotalScore(0); setAnswered(0); setDone(false); setStartTime(Date.now());
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60, color:"#5eead4", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:32 }}>🎓</div><div>Loading training scenarios…</div>
    </div>
  );

  if (done || (!loading && order.length === 0)) return (
    <div style={{ maxWidth:560, margin:"0 auto", padding:32, textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:12 }}>🏆</div>
      <h2 style={{ color:"#eef2f8", fontSize:22, fontWeight:700, marginBottom:8 }}>Session Complete!</h2>
      <div style={{ fontSize:52, fontWeight:800, color:"#2dd4bf", margin:"16px 0" }}>
        {totalScore}<span style={{ fontSize:14, color:"#64748b", fontWeight:400 }}> / {answered * 120} pts</span>
      </div>
      <p style={{ color:"#64748b", fontSize:13, marginBottom:24 }}>
        {answered} scenarios · {answered > 0 ? Math.round((totalScore / (answered * 100)) * 100) : 0}% accuracy
      </p>
      <button onClick={restart} style={{ background:"linear-gradient(135deg,#0d9488,#0284c7)", border:"none", borderRadius:10, color:"#fff", fontWeight:700, fontSize:15, padding:"12px 32px", cursor:"pointer" }}>
        ↻ New Session
      </button>
    </div>
  );

  if (!scenario) return null;

  const diff = DIFF[scenario.difficulty] || DIFF.medium;
  const v = scenario.vitals;

  return (
    <div style={{ maxWidth:820, margin:"0 auto", padding:"20px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
        <div style={{ flex:1, background:"#1e293b", borderRadius:999, height:5, overflow:"hidden" }}>
          <div style={{ width:`${(idx / order.length) * 100}%`, background:"linear-gradient(90deg,#0d9488,#0284c7)", height:"100%", transition:"width 0.3s" }} />
        </div>
        <span style={{ fontSize:11, color:"#475569", whiteSpace:"nowrap" }}>{idx+1}/{order.length}</span>
        <div style={{ background:"#0f1e35", border:"1px solid #1e293b", borderRadius:8, padding:"3px 10px", fontSize:12 }}>
          <span style={{ color:"#64748b" }}>Score </span><span style={{ color:"#2dd4bf", fontWeight:700 }}>{totalScore}</span>
        </div>
      </div>

      <div style={{ background:"#0f1e35", border:"1px solid #1e293b", borderRadius:16, padding:24, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>Patient Presentation</div>
            <div style={{ color:"#eef2f8", fontSize:17, fontWeight:700 }}>{scenario.name}</div>
          </div>
          <span style={{ padding:"3px 10px", borderRadius:999, fontSize:10, fontWeight:700, background:diff.bg, color:diff.color, border:`1px solid ${diff.color}40`, textTransform:"uppercase" }}>
            {scenario.difficulty}
          </span>
        </div>

        <div style={{ background:"rgba(13,148,136,0.06)", border:"1px solid rgba(45,212,191,0.15)", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#0d9488", fontWeight:600, textTransform:"uppercase", marginBottom:4 }}>Chief Complaint</div>
          <div style={{ color:"#eef2f8", fontSize:14, lineHeight:1.55 }}>{scenario.chief_complaint}</div>
        </div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", marginBottom:8 }}>Vital Signs</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
            {[
              { label:"HR",   val:v.hr,               unit:"bpm",  warn:v.hr>100||v.hr<60 },
              { label:"BP",   val:`${v.sbp}/${v.dbp}`, unit:"mmHg", warn:v.sbp<90||v.sbp>180 },
              { label:"RR",   val:v.rr,               unit:"/min", warn:v.rr>20||v.rr<12 },
              { label:"Temp", val:v.temp,             unit:"°C",   warn:v.temp>38.5||v.temp<36 },
              { label:"SpO₂", val:v.o2_sat,           unit:"%",    warn:v.o2_sat<95 },
            ].map(sv => (
              <div key={sv.label} style={{ background:sv.warn?"rgba(239,68,68,0.08)":"#0a1628", border:`1px solid ${sv.warn?"rgba(239,68,68,0.35)":"#1e293b"}`, borderRadius:8, padding:"10px 6px", textAlign:"center" }}>
                <div style={{ fontSize:15, fontWeight:700, color:sv.warn?"#f87171":"#e2e8f0" }}>{sv.val}</div>
                <div style={{ fontSize:9, color:"#475569" }}>{sv.unit}</div>
                <div style={{ fontSize:9, color:"#64748b", marginTop:1 }}>{sv.label}</div>
              </div>
            ))}
          </div>
        </div>

        {(scenario.history.length > 0 || scenario.medications.length > 0) && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {scenario.history.length > 0 && (
              <div>
                <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", marginBottom:6 }}>History</div>
                {scenario.history.map((h,i) => <div key={i} style={{ fontSize:12, color:"#94a3b8", marginBottom:2 }}>• {h}</div>)}
              </div>
            )}
            {scenario.medications.length > 0 && (
              <div>
                <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", marginBottom:6 }}>Medications</div>
                {scenario.medications.map((m,i) => <div key={i} style={{ fontSize:12, color:"#94a3b8", marginBottom:2 }}>• {m}</div>)}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize:13, color:"#7d92ab", fontStyle:"italic", lineHeight:1.6, borderTop:"1px solid #1e293b", paddingTop:12 }}>
          &ldquo;{scenario.presentation_note}&rdquo;
        </div>
      </div>

      {!result && (
        <>
          <div style={{ fontSize:11, color:"#64748b", fontWeight:600, textTransform:"uppercase", marginBottom:10 }}>What is the correct ESI level?</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:14 }}>
            {([1,2,3,4,5] as number[]).map(esi => {
              const c = ESI_CFG[esi];
              const sel = pick === esi;
              return (
                <button key={esi} onClick={() => setPick(esi)}
                  style={{ padding:"14px 6px", borderRadius:10, cursor:"pointer", textAlign:"center", border:`2px solid ${sel?c.color:"#1e293b"}`, background:sel?c.bg:"#0a1628", transition:"all 0.15s" }}>
                  <div style={{ fontSize:20 }}>{c.icon}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:sel?c.color:"#e2e8f0", marginTop:4 }}>ESI {esi}</div>
                  <div style={{ fontSize:9, color:sel?c.color:"#475569", marginTop:2 }}>{c.label}</div>
                </button>
              );
            })}
          </div>
          <button onClick={handleSubmit} disabled={!pick||submitting}
            style={{ width:"100%", padding:14, borderRadius:10, fontSize:15, fontWeight:700, cursor:pick?"pointer":"default", border:"none",
              background:pick?"linear-gradient(135deg,#0d9488,#0284c7)":"#1e293b", color:pick?"#fff":"#475569", transition:"all 0.15s" }}>
            {submitting?"Submitting…":pick?`Submit ESI ${pick}`:"Select an ESI level"}
          </button>
        </>
      )}

      {result && (
        <div style={{ background:result.correct?"rgba(34,197,94,0.06)":"rgba(239,68,68,0.06)", border:`1px solid ${result.correct?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`, borderRadius:16, padding:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ fontSize:32 }}>{result.correct?"✅":"❌"}</div>
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:result.correct?"#4ade80":"#f87171" }}>
                  {result.correct?"Correct!":"Incorrect — ESI "+result.correct_esi+" ("+result.esi_label+")"}
                </div>
                <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>
                  {ESI_CFG[result.correct_esi].icon} You chose ESI {result.your_esi}
                </div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:28, fontWeight:800, color:"#2dd4bf" }}>+{result.score}</div>
              {result.speed_bonus > 0 && <div style={{ fontSize:10, color:"#475569" }}>incl. +{result.speed_bonus} speed</div>}
            </div>
          </div>

          <div style={{ background:"#060e1a", borderRadius:10, padding:"12px 16px", marginBottom:14, borderLeft:"3px solid #0d9488" }}>
            <div style={{ fontSize:10, color:"#0d9488", fontWeight:600, textTransform:"uppercase", marginBottom:5 }}>Clinical Reasoning</div>
            <div style={{ fontSize:13, color:"#94a3b8", lineHeight:1.6 }}>{result.reasoning}</div>
          </div>

          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:10, color:"#64748b", fontWeight:600, textTransform:"uppercase", marginBottom:8 }}>Teaching Points</div>
            {result.teaching_points.map((tp,i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:7 }}>
                <span style={{ color:"#2dd4bf", fontWeight:700, fontSize:12, flexShrink:0 }}>→</span>
                <span style={{ fontSize:13, color:"#94a3b8", lineHeight:1.5 }}>{tp}</span>
              </div>
            ))}
          </div>

          <button onClick={handleNext}
            style={{ width:"100%", padding:14, borderRadius:10, fontSize:15, fontWeight:700, cursor:"pointer", border:"none", background:"linear-gradient(135deg,#0d9488,#0284c7)", color:"#fff" }}>
            {idx+1>=order.length?"See Results →":"Next Case →"}
          </button>
        </div>
      )}
    </div>
  );
}
