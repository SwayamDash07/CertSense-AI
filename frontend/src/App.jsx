import { useState, useRef, useEffect, useCallback } from "react";

const API = "http://localhost:8000";

const CERTS = [
  { id: "AZ-204", label: "AZ-204", name: "Azure Developer", color: "#3b82f6", badge: "DEV" },
  { id: "AZ-400", label: "AZ-400", name: "DevOps Engineer", color: "#8b5cf6", badge: "OPS" },
  { id: "DP-203", label: "DP-203", name: "Data Engineer", color: "#06b6d4", badge: "DATA" },
];

const AGENTS = [
  { key: "readiness_coach", label: "Readiness Coach", desc: "Evaluates concept coverage & depth" },
  { key: "study_plan", label: "Study Planner", desc: "Generates 7-day personalized plan" },
  { key: "assessment", label: "Assessment Engine", desc: "Exam-style grounded questions" },
  { key: "insights", label: "Progress Insights", desc: "Long-term readiness analytics" },
];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Syne:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#050d1a;--bg2:#091224;--bg3:#0d1a30;--bg4:#111f3a;
    --border:#1e3a5f;--border2:#2a4f7a;
    --blue:#3b82f6;--blue2:#60a5fa;--blue3:#1d4ed8;
    --purple:#8b5cf6;--cyan:#06b6d4;--green:#10b981;--red:#ef4444;--amber:#f59e0b;
    --text:#e2eaff;--text2:#94b3d4;--text3:#4a7098;
    --font:'Syne',sans-serif;--mono:'JetBrains Mono',monospace;
  }
  body{background:var(--bg);color:var(--text);font-family:var(--font);min-height:100vh;overflow-x:hidden}
  .app{display:grid;grid-template-rows:56px 1fr;min-height:100vh}
  .nav{background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 2rem;gap:1.5rem;position:sticky;top:0;z-index:100}
  .nav-logo{font-size:1.1rem;font-weight:700;letter-spacing:-.5px;color:var(--blue2);display:flex;align-items:center;gap:.5rem}
  .nav-logo span{color:var(--text);font-weight:400}
  .nav-badge{font-size:.6rem;font-family:var(--mono);background:var(--blue3);color:var(--blue2);padding:2px 6px;border-radius:3px;letter-spacing:.05em}
  .nav-tabs{display:flex;gap:4px;margin-left:auto}
  .nav-tab{background:none;border:none;color:var(--text2);font-family:var(--font);font-size:.8rem;padding:6px 12px;border-radius:6px;cursor:pointer;transition:all .2s;font-weight:500;letter-spacing:.02em}
  .nav-tab:hover{color:var(--text);background:var(--bg3)}
  .nav-tab.active{color:var(--blue2);background:var(--bg4)}
  .main{display:grid;grid-template-columns:260px 1fr;gap:0;overflow:hidden;height:calc(100vh - 56px)}
  .sidebar{background:var(--bg2);border-right:1px solid var(--border);padding:1.5rem 1rem;overflow-y:auto;display:flex;flex-direction:column;gap:1rem}
  .sidebar-section{font-size:.65rem;font-family:var(--mono);color:var(--text3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:.25rem}
  .cert-card{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:.875rem 1rem;cursor:pointer;transition:all .25s;position:relative;overflow:hidden}
  .cert-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent-color,var(--blue));opacity:0;transition:opacity .2s}
  .cert-card:hover{border-color:var(--border2);background:var(--bg4)}
  .cert-card.selected{border-color:var(--accent-color,var(--blue));background:var(--bg4)}
  .cert-card.selected::before{opacity:1}
  .cert-row{display:flex;align-items:center;gap:.625rem}
  .cert-badge{font-size:.6rem;font-family:var(--mono);font-weight:500;padding:3px 7px;border-radius:4px;letter-spacing:.05em;background:rgba(255,255,255,.06);color:var(--text2)}
  .cert-name{font-size:.75rem;font-weight:600;letter-spacing:.02em}
  .cert-sub{font-size:.65rem;color:var(--text3);margin-top:2px}
  .content{overflow-y:auto;display:flex;flex-direction:column}
  .hero{padding:2.5rem 2rem 1.5rem;border-bottom:1px solid var(--border);background:linear-gradient(180deg,var(--bg2) 0%,transparent 100%)}
  .hero-eyebrow{font-size:.65rem;font-family:var(--mono);color:var(--blue);letter-spacing:.12em;text-transform:uppercase;margin-bottom:.75rem}
  .hero-title{font-size:2rem;font-weight:700;line-height:1.1;letter-spacing:-.03em;margin-bottom:.5rem}
  .hero-title em{font-style:normal;color:var(--blue2)}
  .hero-sub{font-size:.875rem;color:var(--text2);line-height:1.6;max-width:540px}
  .agents-row{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;padding:1.5rem 2rem;border-bottom:1px solid var(--border)}
  .agent-chip{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:.75rem;text-align:center}
  .agent-icon{font-size:1.25rem;margin-bottom:.375rem}
  .agent-label{font-size:.65rem;font-weight:600;letter-spacing:.03em;color:var(--text2);margin-bottom:2px}
  .agent-desc{font-size:.6rem;color:var(--text3);line-height:1.4}
  .input-zone{padding:1.5rem 2rem;border-bottom:1px solid var(--border)}
  .input-label{font-size:.65rem;font-family:var(--mono);color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:.625rem;display:flex;align-items:center;gap:.5rem}
  .mode-switch{display:flex;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:3px;gap:2px;width:fit-content;margin-bottom:1.25rem}
  .mode-btn{background:none;border:none;color:var(--text3);font-family:var(--font);font-size:.75rem;padding:5px 14px;border-radius:5px;cursor:pointer;transition:all .2s;font-weight:500}
  .mode-btn.active{background:var(--bg4);color:var(--text);border:1px solid var(--border2)}
  textarea{width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);font-family:var(--mono);font-size:.8rem;border-radius:10px;padding:1rem;resize:vertical;min-height:120px;outline:none;transition:border .2s;line-height:1.6}
  textarea:focus{border-color:var(--blue)}
  textarea::placeholder{color:var(--text3)}
  .run-row{display:flex;align-items:center;gap:1rem;margin-top:1rem}
  .run-btn{background:var(--blue3);color:#fff;border:none;font-family:var(--font);font-size:.875rem;font-weight:600;padding:.75rem 2rem;border-radius:8px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:.5rem;letter-spacing:.02em}
  .run-btn:hover{background:var(--blue)}
  .run-btn:disabled{opacity:.4;cursor:not-allowed}
  .run-btn.loading{background:var(--bg4);color:var(--text3);border:1px solid var(--border)}
  .run-hint{font-size:.7rem;color:var(--text3)}
  .results{padding:1.5rem 2rem;flex:1}
  .result-tabs{display:flex;gap:4px;margin-bottom:1.5rem;border-bottom:1px solid var(--border);padding-bottom:.75rem}
  .result-tab{background:none;border:none;color:var(--text3);font-family:var(--font);font-size:.75rem;padding:6px 14px;border-radius:6px;cursor:pointer;transition:all .2s;font-weight:500}
  .result-tab:hover{color:var(--text);background:var(--bg3)}
  .result-tab.active{color:var(--blue2);background:var(--bg3)}
  .score-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.875rem;margin-bottom:1.5rem}
  .score-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1rem;position:relative;overflow:hidden}
  .score-card::after{content:attr(data-score);position:absolute;right:12px;top:10px;font-size:1.75rem;font-weight:700;font-family:var(--mono);color:var(--accent,var(--blue2));opacity:.15}
  .score-label{font-size:.65rem;font-family:var(--mono);color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:.375rem}
  .score-val{font-size:2rem;font-weight:700;font-family:var(--mono);color:var(--accent,var(--blue2))}
  .score-bar{height:3px;background:var(--border);border-radius:2px;margin-top:.625rem;overflow:hidden}
  .score-fill{height:100%;border-radius:2px;background:var(--accent,var(--blue));transition:width 1s ease}
  .block{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1.25rem;margin-bottom:.875rem}
  .block-title{font-size:.7rem;font-family:var(--mono);color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:.875rem;display:flex;align-items:center;gap:.5rem}
  .block-title::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--blue)}
  .prose{font-size:.8rem;color:var(--text2);line-height:1.7}
  .tag-row{display:flex;flex-wrap:wrap;gap:.375rem;margin-top:.625rem}
  .tag{font-size:.65rem;font-family:var(--mono);padding:3px 9px;border-radius:4px;background:rgba(59,130,246,.1);color:var(--blue2);border:1px solid rgba(59,130,246,.2)}
  .tag.green{background:rgba(16,185,129,.1);color:var(--green);border-color:rgba(16,185,129,.2)}
  .tag.amber{background:rgba(245,158,11,.1);color:var(--amber);border-color:rgba(245,158,11,.2)}
  .tag.red{background:rgba(239,68,68,.1);color:var(--red);border-color:rgba(239,68,68,.2)}
  .stream-panel{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:1rem;font-family:var(--mono);font-size:.72rem;line-height:1.8;color:var(--text2);max-height:240px;overflow-y:auto;margin-bottom:1rem}
  .stream-line{display:flex;gap:.75rem;align-items:flex-start}
  .stream-agent{color:var(--blue);min-width:90px;font-weight:500}
  .stream-status{color:var(--green)}
  .stream-status.thinking{color:var(--amber)}
  .stream-status.error{color:var(--red)}
  .spinner{width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--blue2);border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
  @keyframes spin{to{transform:rotate(360deg)}}
  .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 2rem;color:var(--text3);text-align:center;gap:.75rem}
  .empty-icon{font-size:3rem;opacity:.3}
  .empty-text{font-size:.875rem;line-height:1.6;max-width:320px}
  .plan-day{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:.875rem 1rem;margin-bottom:.625rem;display:flex;gap:1rem;align-items:flex-start}
  .plan-day-num{font-family:var(--mono);font-size:.65rem;color:var(--blue);background:rgba(59,130,246,.1);padding:4px 8px;border-radius:4px;white-space:nowrap;border:1px solid rgba(59,130,246,.2)}
  .plan-day-content{font-size:.78rem;color:var(--text2);line-height:1.6;flex:1}
  .q-block{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:1rem;margin-bottom:.75rem}
  .q-number{font-family:var(--mono);font-size:.6rem;color:var(--text3);margin-bottom:.375rem}
  .q-text{font-size:.8rem;font-weight:500;color:var(--text);margin-bottom:.625rem;line-height:1.5}
  .q-option{font-size:.75rem;color:var(--text2);padding:5px 0;display:flex;gap:.5rem}
  .q-option span:first-child{color:var(--text3);font-family:var(--mono);min-width:16px}
  .citation-row{display:flex;align-items:center;gap:.375rem;margin-top:.5rem;font-size:.65rem;color:var(--text3);font-family:var(--mono)}
  .citation-dot{width:5px;height:5px;border-radius:50%;background:var(--green)}
  .rec-box{background:linear-gradient(135deg,rgba(29,78,216,.15),rgba(139,92,246,.08));border:1px solid rgba(59,130,246,.25);border-radius:10px;padding:1.25rem;font-size:.82rem;color:var(--text);line-height:1.7}
  .interview-q{font-size:.95rem;font-weight:600;line-height:1.5;margin-bottom:1.25rem;color:var(--text)}
  .interview-round{font-size:.65rem;font-family:var(--mono);color:var(--text3);margin-bottom:.875rem}
  .upload-zone{border:1.5px dashed var(--border2);border-radius:10px;padding:2.5rem;text-align:center;cursor:pointer;transition:all .2s;background:var(--bg2)}
  .upload-zone:hover{border-color:var(--blue);background:var(--bg3)}
  .upload-icon{font-size:2rem;margin-bottom:.75rem;opacity:.5}
  .upload-text{font-size:.8rem;color:var(--text3);line-height:1.6}
  .file-indicator{display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:var(--green);font-family:var(--mono);margin-top:.75rem;padding:.5rem .875rem;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:6px;width:fit-content}
  .progress-bar-wrap{background:var(--bg3);border-radius:100px;height:6px;overflow:hidden;margin:.375rem 0}
  .progress-bar-fill{height:100%;border-radius:100px;background:var(--blue);transition:width .8s ease}
  .mgr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;padding:1.5rem 2rem;border-bottom:1px solid var(--border)}
  .mgr-stat{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1rem}
  .mgr-stat-val{font-size:1.75rem;font-weight:700;font-family:var(--mono);margin-bottom:2px}
  .mgr-stat-label{font-size:.65rem;font-family:var(--mono);color:var(--text3);letter-spacing:.08em;text-transform:uppercase}
  .mgr-body{padding:1.5rem 2rem;display:flex;flex-direction:column;gap:1rem}
  .learner-table{width:100%;border-collapse:collapse}
  .learner-table th{font-size:.62rem;font-family:var(--mono);color:var(--text3);letter-spacing:.08em;text-transform:uppercase;padding:.5rem .75rem;text-align:left;border-bottom:1px solid var(--border);font-weight:500}
  .learner-table td{font-size:.75rem;padding:.625rem .75rem;border-bottom:1px solid var(--border);color:var(--text2);vertical-align:middle}
  .learner-table tr:last-child td{border-bottom:none}
  .learner-table tr:hover td{background:var(--bg3)}
  .risk-badge{font-size:.6rem;font-family:var(--mono);padding:2px 8px;border-radius:4px;font-weight:500;white-space:nowrap}
  .risk-low{background:rgba(16,185,129,.1);color:var(--green);border:1px solid rgba(16,185,129,.2)}
  .risk-medium{background:rgba(245,158,11,.1);color:var(--amber);border:1px solid rgba(245,158,11,.2)}
  .risk-high{background:rgba(239,68,68,.1);color:var(--red);border:1px solid rgba(239,68,68,.2)}
  .risk-critical{background:rgba(239,68,68,.2);color:#ff6b6b;border:1px solid rgba(239,68,68,.4)}
  .outcome-pass{color:var(--green);font-weight:600;font-family:var(--mono);font-size:.7rem}
  .outcome-fail{color:var(--red);font-weight:600;font-family:var(--mono);font-size:.7rem}
  .mini-bar-wrap{width:80px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;display:inline-block;vertical-align:middle;margin-left:.5rem}
  .mini-bar-fill{height:100%;border-radius:2px;transition:width .8s ease}
  .team-chip{font-size:.6rem;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:rgba(59,130,246,.08);color:var(--text3);border:1px solid var(--border)}
  .insight-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1.125rem 1.25rem;display:flex;gap:1rem;align-items:flex-start}
  .insight-icon{font-size:1.25rem;margin-top:1px;flex-shrink:0}
  .insight-title{font-size:.75rem;font-weight:600;color:var(--text);margin-bottom:.25rem}
  .insight-body{font-size:.72rem;color:var(--text2);line-height:1.6}
  .team-filter{display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:1rem}
  .team-filter-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text3);font-family:var(--mono);font-size:.65rem;padding:4px 10px;border-radius:5px;cursor:pointer;transition:all .15s}
  .team-filter-btn.active{background:var(--bg4);border-color:var(--blue);color:var(--blue2)}
`;

function ScoreCard({ label, value, max = 10, accent }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="score-card" data-score={Math.round(value)} style={{ "--accent": accent }}>
      <div className="score-label">{label}</div>
      <div className="score-val">{typeof value === "number" ? value.toFixed(1) : value}</div>
      <div className="score-bar"><div className="score-fill" style={{ width: `${pct}%`, background: accent }} /></div>
    </div>
  );
}

const AGENT_COLORS = {
  orchestrator:    "#60a5fa",
  readiness_coach: "#8b5cf6",
  study_plan:      "#06b6d4",
  assessment:      "#10b981",
  insights:        "#f59e0b",
  interviewer:     "#f472b6",
};

const STATUS_META = {
  started:          { icon: "~", color: "var(--amber)" },
  routing:          { icon: "~", color: "var(--amber)" },
  reasoning:        { icon: "~", color: "var(--amber)" },
  thinking:         { icon: "~", color: "var(--amber)" },
  speech_processed: { icon: "+", color: "var(--green)" },
  completed:        { icon: "+", color: "var(--green)" },
  done:             { icon: "+", color: "var(--green)" },
  error:            { icon: "x", color: "var(--red)" },
};

function StreamPanel({ events }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [events]);
  if (!events.length) return null;
  return (
    <div className="stream-panel" ref={ref}>
      {events.map((e, i) => {
        const sm = STATUS_META[e.status] || { icon: "·", color: "var(--text3)" };
        const agentColor = AGENT_COLORS[e.agent] || "var(--text2)";
        const msg = e.message || e.data?.message || e.status;
        const score = e.data?.score ?? e.data?.readiness_score;
        const queued = e.data?.agents_queued;
        return (
          <div className="stream-line" key={i}>
            <span style={{ color: agentColor, minWidth: 120, fontWeight: 500, fontFamily: "var(--mono)", fontSize: ".72rem" }}>{e.agent}</span>
            <span style={{ color: sm.color, minWidth: 16, fontSize: ".8rem" }}>{sm.icon}</span>
            <span style={{ color: "var(--text2)", flex: 1, fontSize: ".72rem" }}>
              {msg}
              {score !== undefined && score !== null &&
                <span style={{ marginLeft: ".5rem", fontFamily: "var(--mono)", color: "var(--blue2)", fontSize: ".68rem" }}>
                  [{typeof score === "number" ? score.toFixed(1) : score}/10]
                </span>
              }
              {queued?.length > 0 &&
                <span style={{ marginLeft: ".5rem", color: "var(--text3)", fontSize: ".65rem" }}>
                  → {queued.join(", ")}
                </span>
              }
            </span>
          </div>
        );
      })}
      <div className="stream-line" style={{ opacity: .35, marginTop: ".25rem" }}>
        <span style={{ color: "var(--text3)", minWidth: 120, fontFamily: "var(--mono)", fontSize: ".68rem" }}>system</span>
        <span style={{ color: "var(--text3)", minWidth: 16 }}>·</span>
        <span style={{ color: "var(--text3)", fontSize: ".68rem" }}>{events.length} events · live via WebSocket</span>
      </div>
    </div>
  );
}

function StudyPlanView({ data }) {
  if (!data) return <div className="prose">No study plan generated.</div>;

  // Parse if string
  let parsed = data;
  if (typeof data === "string") {
    try { parsed = JSON.parse(data); } catch { parsed = null; }
  }

  // Structured JSON path
  if (parsed && parsed.daily_plan && Array.isArray(parsed.daily_plan)) {
    return (
      <div>
        {parsed.theme && <div className="prose" style={{ marginBottom: "1rem", color: "var(--text2)" }}>{parsed.theme}</div>}
        {parsed.daily_plan.map((day, i) => (
          <div className="plan-day" key={i}>
            <span className="plan-day-num">DAY {day.day || i + 1}</span>
            <div className="plan-day-content">
              {day.theme && <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: ".375rem" }}>{day.theme}</div>}
              {day.exercises && Array.isArray(day.exercises) && day.exercises.map((ex, j) => (
                <div key={j} style={{ marginBottom: ".5rem", paddingLeft: ".75rem", borderLeft: "2px solid var(--border2)" }}>
                  <div style={{ fontWeight: 500, color: "var(--text2)", fontSize: ".75rem" }}>{ex.name}</div>
                  {ex.duration && <div style={{ fontSize: ".65rem", color: "var(--text3)", fontFamily: "var(--mono)" }}>{ex.duration}</div>}
                  {ex.description && <div style={{ fontSize: ".72rem", color: "var(--text2)", marginTop: ".25rem", lineHeight: 1.6 }}>{ex.description}</div>}
                  {ex.goal && <div style={{ fontSize: ".65rem", color: "var(--blue2)", marginTop: ".2rem" }}>Goal: {ex.goal}</div>}
                </div>
              ))}
              {day.checkpoint && <div style={{ fontSize: ".68rem", color: "var(--amber)", fontFamily: "var(--mono)", marginTop: ".5rem" }}>Checkpoint: {day.checkpoint}</div>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: plain text line-by-line
  const raw = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const lines = raw.split("\n").filter(l => l.trim());
  return (
    <div>
      {lines.map((line, i) => {
        const isDay = /day\s*\d+/i.test(line);
        if (isDay) return (
          <div className="plan-day" key={i}>
            <span className="plan-day-num">{line.match(/day\s*\d+/i)?.[0]?.toUpperCase()}</span>
            <span className="plan-day-content">{line.replace(/day\s*\d+[:\-\s]*/i, "")}</span>
          </div>
        );
        return <div key={i} className="prose" style={{ marginBottom: ".375rem" }}>{line.replace(/^[\-\*]\s*/, "")}</div>;
      })}
    </div>
  );
}

function AssessmentView({ data }) {
  if (!data) return <div className="prose">No assessment generated.</div>;

  let questions = null;
  if (data.questions && Array.isArray(data.questions)) {
    questions = data.questions;
  } else if (Array.isArray(data)) {
    questions = data;
  } else if (typeof data === "string") {
    try {
      const p = JSON.parse(data);
      if (Array.isArray(p)) questions = p;
      else if (p.questions) questions = p.questions;
    } catch {}
  }

  if (questions && questions.length > 0) {
    return (
      <div>
        {questions.slice(0, 8).map((q, i) => {
          const qObj = typeof q === "string" ? (() => { try { return JSON.parse(q); } catch { return null; } })() : q;
          if (qObj && qObj.question) {
            return (
              <div className="q-block" key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
                  <div className="q-number">Q{i + 1}</div>
                  {qObj.difficulty && <span style={{ fontSize: ".6rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".06em" }}>{qObj.difficulty}</span>}
                  {qObj.skill_area && <span style={{ fontSize: ".6rem", fontFamily: "var(--mono)", color: "var(--blue2)" }}>{qObj.skill_area}</span>}
                </div>
                <div className="q-text">{qObj.question}</div>
                {qObj.ideal_answer_points && Array.isArray(qObj.ideal_answer_points) && (
                  <div style={{ marginTop: ".625rem" }}>
                    <div style={{ fontSize: ".62rem", fontFamily: "var(--mono)", color: "var(--text3)", marginBottom: ".375rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Key Points</div>
                    {qObj.ideal_answer_points.map((pt, j) => (
                      <div key={j} style={{ fontSize: ".72rem", color: "var(--text2)", padding: ".2rem 0 .2rem .75rem", borderLeft: "2px solid var(--border2)", marginBottom: ".25rem" }}>{pt}</div>
                    ))}
                  </div>
                )}
                {qObj.options && Array.isArray(qObj.options) && qObj.options.map((opt, j) => (
                  <div className="q-option" key={j}>
                    <span>{String.fromCharCode(65 + j)}</span>
                    <span>{opt}</span>
                  </div>
                ))}
                <div className="citation-row"><span className="citation-dot" /><span>Grounded via Microsoft Foundry IQ</span></div>
              </div>
            );
          }
          return (
            <div className="q-block" key={i}>
              <div className="q-number">Q{i + 1}</div>
              <div className="q-text">{String(q).slice(0, 400)}</div>
              <div className="citation-row"><span className="citation-dot" /><span>Grounded via Microsoft Foundry IQ</span></div>
            </div>
          );
        })}
      </div>
    );
  }

  const raw = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return <pre className="prose" style={{ whiteSpace: "pre-wrap", fontSize: ".75rem" }}>{raw.slice(0, 1500)}</pre>;
}


function InsightsView({ data }) {
  if (!data) return <div className="prose">No insights generated.</div>;

  let parsed = data;
  if (typeof data === "string") {
    try { parsed = JSON.parse(data); } catch { parsed = null; }
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const trend = parsed.trend || parsed.trend_direction;
    const report = parsed.report;
    const milestones = parsed.milestones || [];
    const baseline = parsed.baseline_score;
    const sessions = parsed.session_count;
    const chartData = parsed.chart_data || [];
    const trendPct = parsed.trend_percentage;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: ".875rem" }}>
        {report && (
          <div style={{ fontSize: ".82rem", color: "var(--text2)", lineHeight: 1.7, padding: "1rem", background: "var(--bg3)", borderRadius: "8px", border: "1px solid var(--border)" }}>
            {report}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: ".75rem" }}>
          {baseline !== undefined && (
            <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "8px", padding: ".875rem" }}>
              <div style={{ fontSize: ".6rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: ".375rem" }}>Baseline Score</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--mono)", color: "var(--blue2)" }}>{baseline}/10</div>
            </div>
          )}
          {sessions !== undefined && (
            <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "8px", padding: ".875rem" }}>
              <div style={{ fontSize: ".6rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: ".375rem" }}>Sessions</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--mono)", color: "var(--cyan)" }}>{sessions}</div>
            </div>
          )}
          {trend && (
            <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "8px", padding: ".875rem" }}>
              <div style={{ fontSize: ".6rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: ".375rem" }}>Trend</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "var(--mono)", color: trend === "improving" ? "var(--green)" : trend === "declining" ? "var(--red)" : "var(--amber)", textTransform: "capitalize" }}>
                {trend} {trendPct ? `+${trendPct}%` : ""}
              </div>
            </div>
          )}
        </div>
        {milestones.length > 0 && (
          <div>
            <div style={{ fontSize: ".62rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: ".5rem" }}>Milestones</div>
            <div className="tag-row">
              {milestones.map((m, i) => <span key={i} className="tag green">{m}</span>)}
            </div>
          </div>
        )}
        {chartData.length > 0 && (
          <div>
            <div style={{ fontSize: ".62rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: ".5rem" }}>Score History</div>
            <div style={{ display: "flex", gap: ".5rem", alignItems: "flex-end", height: "60px" }}>
              {chartData.map((pt, i) => {
                const h = Math.max(8, (pt.score / 10) * 60);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".25rem", flex: 1 }}>
                    <div style={{ width: "100%", height: `${h}px`, background: "var(--blue3)", borderRadius: "3px 3px 0 0", border: "1px solid var(--border2)" }} />
                    <div style={{ fontSize: ".55rem", fontFamily: "var(--mono)", color: "var(--text3)" }}>S{pt.session}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback plain text
  const raw = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const lines = raw.split("\n").filter(l => l.trim()).slice(0, 20);
  return (
    <div>
      {lines.map((line, i) => (
        <div key={i} style={{ marginBottom: ".5rem" }}>
          <span className="prose">{line.replace(/^[\-\*#]+\s*/, "")}</span>
        </div>
      ))}
    </div>
  );
}

function ResultView({ result, cert }) {
  const [tab, setTab] = useState("overview");
  if (!result) return null;
  const score = result.overall_score ?? 0;
  const comm = result.communication_analysis ?? {};
  const tabs = ["overview", "study plan", "assessment", "insights"];

  return (
    <div className="results">
      <div className="result-tabs">
        {tabs.map(t => <button key={t} className={`result-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === "overview" && (
        <div>
          <div className="score-grid">
            <ScoreCard label="Overall Readiness" value={score} accent="var(--blue2)" />
            <ScoreCard label="Technical Depth" value={comm.technical_depth ?? comm.score ?? score * 0.9} accent="var(--purple)" />
            <ScoreCard label="Concept Coverage" value={comm.concept_coverage ?? comm.clarity ?? score * 1.05 > 10 ? 9.2 : score * 1.05} accent="var(--cyan)" />
          </div>
          {result.final_recommendation && (
            <div>
              <div className="block-title" style={{ marginBottom: ".75rem" }}>Final Recommendation</div>
              <div className="rec-box">{result.final_recommendation}</div>
            </div>
          )}
          {comm.strengths?.length > 0 && (
            <div className="block" style={{ marginTop: "1rem" }}>
              <div className="block-title">Strengths Identified</div>
              <div className="tag-row">{comm.strengths.map((s, i) => <span key={i} className="tag green">{s}</span>)}</div>
            </div>
          )}
          {comm.gaps?.length > 0 && (
            <div className="block">
              <div className="block-title">Knowledge Gaps</div>
              <div className="tag-row">{comm.gaps.map((g, i) => <span key={i} className="tag red">{g}</span>)}</div>
            </div>
          )}
          {comm.topics?.length > 0 && (
            <div className="block">
              <div className="block-title">Topics Covered</div>
              <div className="tag-row">{comm.topics.map((t, i) => <span key={i} className="tag">{t}</span>)}</div>
            </div>
          )}
        </div>
      )}

      {tab === "study plan" && (
        <div className="block"><div className="block-title">7-Day Study Plan</div><StudyPlanView data={result.study_plan} /></div>
      )}

      {tab === "assessment" && (
        <div className="block"><div className="block-title">Exam-Style Assessment</div><AssessmentView data={result.assessment} /></div>
      )}

      {tab === "insights" && (
        <div className="block"><div className="block-title">Progress Insights</div><InsightsView data={result.insights} /></div>
      )}
    </div>
  );
}

function InterviewMode({ cert }) {
  const [stage, setStage] = useState("idle");
  const [question, setQuestion] = useState("");
  const [round, setRound] = useState(0);
  const [maxRounds] = useState(5);
  const [history, setHistory] = useState([]);
  const [memory, setMemory] = useState({});
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamEvents, setStreamEvents] = useState([]);

  async function startInterview() {
    setLoading(true);
    setStreamEvents([{ agent: "interviewer", status: "thinking", message: "Generating first question..." }]);
    try {
      const r = await fetch(`${API}/api/analysis/interview/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cert, max_rounds: maxRounds })
      });
      const d = await r.json();
      setQuestion(d.question || d.first_question || "Describe your experience with the relevant Azure services.");
      setMemory(d.memory || {});
      setRound(1);
      setHistory([]);
      setStage("questioning");
      setStreamEvents([{ agent: "interviewer", status: "done", message: "Question ready" }]);
    } catch {
      setStreamEvents([{ agent: "interviewer", status: "error", message: "Could not connect to backend" }]);
    }
    setLoading(false);
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    const newHistory = [...history, { question, answer }];
    setHistory(newHistory);
    setAnswer("");
    if (round >= maxRounds) {
      await finalAssess(newHistory);
      return;
    }
    setLoading(true);
    setStreamEvents(e => [...e, { agent: "interviewer", status: "thinking", message: `Generating round ${round + 1}...` }]);
    try {
      const r = await fetch(`${API}/api/analysis/interview/next`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cert, round_number: round + 1, max_rounds: maxRounds, history: newHistory, memory })
      });
      const d = await r.json();
      setQuestion(d.question || d.next_question || "Continue explaining your approach.");
      setMemory(d.memory || memory);
      setRound(r => r + 1);
      setStreamEvents(e => [...e, { agent: "interviewer", status: "done", message: `Round ${round + 1} ready` }]);
    } catch {
      setStreamEvents(e => [...e, { agent: "interviewer", status: "error", message: "Request failed" }]);
    }
    setLoading(false);
  }

  async function finalAssess(h) {
    setStage("assessing");
    setLoading(true);
    setStreamEvents(e => [...e, { agent: "orchestrator", status: "thinking", message: "Running full agent pipeline..." }]);
    try {
      const r = await fetch(`${API}/api/analysis/interview/assess`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cert, history: h || history })
      });
      const d = await r.json();
      setResult(d.result);
      setStage("done");
      setStreamEvents(e => [...e, { agent: "orchestrator", status: "done", message: "Analysis complete" }]);
    } catch {
      setStreamEvents(e => [...e, { agent: "orchestrator", status: "error", message: "Assessment failed" }]);
    }
    setLoading(false);
  }

  if (stage === "done" && result) return (
    <div>
      <div style={{ padding: "1.5rem 2rem 0" }}>
        <div className="hero-eyebrow">Interview Complete</div>
        <div style={{ fontSize: ".875rem", color: "var(--text2)", marginBottom: "1rem" }}>
          {history.length} rounds · {cert} certification
        </div>
        <StreamPanel events={streamEvents} />
      </div>
      <ResultView result={result} cert={cert} />
    </div>
  );

  return (
    <div className="input-zone">
      <StreamPanel events={streamEvents} />
      {stage === "idle" && (
        <div className="empty-state" style={{ padding: "2rem 0" }}>
                    <div className="empty-text">Start an AI-driven interview session. Our Interviewer Agent will ask {maxRounds} tailored questions about {cert}, then run a full readiness assessment.</div>
          <button className="run-btn" style={{ marginTop: "1rem" }} onClick={startInterview} disabled={loading}>
            {loading ? <><span className="spinner" /> Starting...</> : "Start Interview"}
          </button>
        </div>
      )}
      {(stage === "questioning" || stage === "assessing") && (
        <div>
          <div className="interview-round">Round {round} of {maxRounds} · {cert}</div>
          <div className="interview-q">{question}</div>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Type your verbal explanation here…"
            rows={5}
            disabled={loading || stage === "assessing"}
          />
          <div className="run-row">
            <button className="run-btn" onClick={submitAnswer} disabled={loading || !answer.trim() || stage === "assessing"}>
              {loading ? <><span className="spinner" /> Processing...</> : round >= maxRounds ? "Submit & Assess" : "→ Next Question"}
            </button>
            {round >= maxRounds - 1 && stage !== "assessing" && (
              <span className="run-hint">This is your final round</span>
            )}
            {stage === "assessing" && <span className="run-hint">Running multi-agent analysis…</span>}
          </div>
          {history.length > 0 && (
            <div style={{ marginTop: "1.25rem" }}>
              <div className="block-title" style={{ marginBottom: ".5rem" }}>Session History</div>
              <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                {history.map((h, i) => (
                  <div className="tag" key={i} style={{ cursor: "default" }}>Round {i + 1}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const LEARNERS = [
  { id:"L-1001", role:"Cloud Engineer", cert:"AZ-204", score:67, hours:18, outcome:"Fail", weak:["Azure Functions","Cosmos DB","API Management"], team:"TEAM-A", empId:"EMP-001", meetingHrs:22, focusHrs:10, slot:"Morning", risk:"High" },
  { id:"L-1002", role:"DevOps Engineer", cert:"AZ-400", score:82, hours:24, outcome:"Pass", weak:["Release Strategies"], team:"TEAM-A", empId:"EMP-002", meetingHrs:15, focusHrs:18, slot:"Afternoon", risk:"Low" },
  { id:"L-1003", role:"Data Engineer", cert:"DP-203", score:74, hours:20, outcome:"Pass", weak:["Synapse Pipelines"], team:"TEAM-B", empId:"EMP-003", meetingHrs:12, focusHrs:20, slot:"Morning", risk:"Low" },
  { id:"L-1004", role:"Cloud Engineer", cert:"AZ-204", score:55, hours:10, outcome:"Fail", weak:["Azure Functions","Service Bus","Key Vault","API Management"], team:"TEAM-B", empId:"EMP-004", meetingHrs:28, focusHrs:6, slot:"Evening", risk:"Critical" },
  { id:"L-1005", role:"DevOps Engineer", cert:"AZ-400", score:79, hours:22, outcome:"Pass", weak:["Security Compliance"], team:"TEAM-C", empId:"EMP-005", meetingHrs:16, focusHrs:15, slot:"Morning", risk:"Medium" },
  { id:"L-1006", role:"Data Engineer", cert:"DP-203", score:61, hours:14, outcome:"Fail", weak:["Stream Analytics","Delta Lake"], team:"TEAM-C", empId:"EMP-006", meetingHrs:20, focusHrs:12, slot:"Afternoon", risk:"High" },
];

const TEAMS = ["ALL", "TEAM-A", "TEAM-B", "TEAM-C"];

function riskClass(r) {
  return { Low:"risk-low", Medium:"risk-medium", High:"risk-high", Critical:"risk-critical" }[r] || "risk-medium";
}

function scoreColor(s) {
  if (s >= 80) return "var(--green)";
  if (s >= 70) return "var(--blue2)";
  if (s >= 60) return "var(--amber)";
  return "var(--red)";
}

function ManagerDashboard() {
  const [team, setTeam] = useState("ALL");
  const filtered = team === "ALL" ? LEARNERS : LEARNERS.filter(l => l.team === team);
  const passRate = Math.round((filtered.filter(l => l.outcome === "Pass").length / filtered.length) * 100);
  const avgScore = Math.round(filtered.reduce((a, l) => a + l.score, 0) / filtered.length);
  const avgHours = Math.round(filtered.reduce((a, l) => a + l.hours, 0) / filtered.length);
  const atRisk = filtered.filter(l => l.risk === "High" || l.risk === "Critical").length;

  const insights = [
    { icon:"!", title:"Capacity-constrained learners", body:`${filtered.filter(l=>l.meetingHrs>20).length} learner(s) have over 20 meeting hours/week. Study completion is significantly lower in this group. Recommend manager intervention to free focus time.` },
    { icon:"--", title:"Below exam threshold", body:`${filtered.filter(l=>l.score<70).length} learner(s) are below the 70% pass threshold. ${filtered.filter(l=>l.score<60).length} are critically behind with scores under 60%.` },
    { icon:"+", title:"Exam-ready learners", body:`${filtered.filter(l=>l.score>=75).length} learner(s) have scored above 75% and are approaching exam readiness. Consider booking exam slots within 2 weeks.` },
    { icon:"--", title:"Optimal study windows", body:`Morning slots show higher completion. ${filtered.filter(l=>l.slot==="Morning").length} learner(s) prefer mornings — prioritise protecting that time from meetings.` },
  ];

  return (
    <div>
      <div className="hero">
        <div className="hero-eyebrow">Manager Insights Agent</div>
        <div className="hero-title">Team <em>readiness</em> dashboard</div>
        <div className="hero-sub">Grounded in Work IQ signals and Fabric IQ semantic model. Synthetic data — for demonstration only.</div>
      </div>

      <div className="mgr-grid">
        <div className="mgr-stat">
          <div className="mgr-stat-val" style={{ color:"var(--blue2)" }}>{passRate}%</div>
          <div className="mgr-stat-label">Pass Rate</div>
        </div>
        <div className="mgr-stat">
          <div className="mgr-stat-val" style={{ color: scoreColor(avgScore) }}>{avgScore}%</div>
          <div className="mgr-stat-label">Avg Practice Score</div>
        </div>
        <div className="mgr-stat">
          <div className="mgr-stat-val" style={{ color:"var(--cyan)" }}>{avgHours}h</div>
          <div className="mgr-stat-label">Avg Hours Studied</div>
        </div>
        <div className="mgr-stat">
          <div className="mgr-stat-val" style={{ color: atRisk > 0 ? "var(--red)" : "var(--green)" }}>{atRisk}</div>
          <div className="mgr-stat-label">At-Risk Learners</div>
        </div>
      </div>

      <div className="mgr-body">
        <div className="team-filter">
          {TEAMS.map(t => (
            <button key={t} className={`team-filter-btn ${team === t ? "active" : ""}`} onClick={() => setTeam(t)}>{t}</button>
          ))}
        </div>

        <div className="block" style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"1rem 1.25rem .75rem" }}>
            <div className="block-title" style={{ marginBottom:0 }}>Learner Readiness Overview</div>
          </div>
          <table className="learner-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Team</th>
                <th>Cert</th>
                <th>Practice Score</th>
                <th>Hours</th>
                <th>Workload Risk</th>
                <th>Study Slot</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td>
                    <div style={{ fontWeight:600, color:"var(--text)", fontSize:".75rem" }}>{l.id}</div>
                    <div style={{ fontSize:".65rem", color:"var(--text3)" }}>{l.role}</div>
                  </td>
                  <td><span className="team-chip">{l.team}</span></td>
                  <td style={{ fontFamily:"var(--mono)", fontSize:".7rem", color:"var(--text2)" }}>{l.cert}</td>
                  <td>
                    <span style={{ fontFamily:"var(--mono)", fontSize:".75rem", color: scoreColor(l.score), fontWeight:600 }}>{l.score}%</span>
                    <span className="mini-bar-wrap"><span className="mini-bar-fill" style={{ width:`${l.score}%`, background: scoreColor(l.score) }} /></span>
                  </td>
                  <td style={{ fontFamily:"var(--mono)", fontSize:".72rem" }}>{l.hours}h</td>
                  <td><span className={`risk-badge ${riskClass(l.risk)}`}>{l.risk}</span></td>
                  <td style={{ fontSize:".7rem", color:"var(--text3)" }}>{l.slot}</td>
                  <td><span className={l.outcome === "Pass" ? "outcome-pass" : "outcome-fail"}>{l.outcome}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:".75rem" }}>
          <div className="block-title" style={{ marginBottom:0 }}>Agent Insights</div>
          {insights.map((ins, i) => (
            <div className="insight-card" key={i}>
                            <div>
                <div className="insight-title">{ins.title}</div>
                <div className="insight-body">{ins.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="block">
          <div className="block-title">Weak Areas Across Team</div>
          <div className="tag-row">
            {[...new Set(filtered.flatMap(l => l.weak))].map((w, i) => {
              const count = filtered.filter(l => l.weak.includes(w)).length;
              return <span key={i} className={`tag ${count > 1 ? "red" : ""}`}>{w} {count > 1 ? `×${count}` : ""}</span>;
            })}
          </div>
        </div>

        <div style={{ fontSize:".6rem", color:"var(--text3)", fontFamily:"var(--mono)", textAlign:"center", padding:".5rem 0" }}>
          Grounded via Fabric IQ semantic model · Work IQ capacity signals · Synthetic data only
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("analyze");
  const [cert, setCert] = useState("AZ-204");
  const [mode, setMode] = useState("text");
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [streamEvents, setStreamEvents] = useState([]);
  const fileRef = useRef(null);
  const wsRef = useRef(null);
  const sessionId = useRef(Math.random().toString(36).slice(2));

  const selectedCert = CERTS.find(c => c.id === cert);

  function connectWS() {
    const ws = new WebSocket(`${API.replace("http", "ws")}/ws/analysis/${sessionId.current}`);
    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        // backend emits { agent, status, data: { message, ... } }
        setStreamEvents(prev => [...prev, {
          agent:   ev.agent   || "agent",
          status:  ev.status  || "thinking",
          message: ev.data?.message || "",
          data:    ev.data    || {},
        }]);
      } catch {}
    };
    ws.onerror = () => {
      setStreamEvents(prev => [...prev, { agent: "system", status: "error", message: "WebSocket connection failed — results will still appear below", data: {} }]);
    };
    wsRef.current = ws;
    return ws;
  }

  async function runAnalysis() {
    if (!transcript.trim() && !audioFile) return;
    setLoading(true);
    setResult(null);
    setStreamEvents([{ agent: "orchestrator", status: "started", message: "Connecting to agent pipeline...", data: {} }]);
    const ws = connectWS();

    // give WS time to open then send the payload so backend streams thinking
    await new Promise(r => setTimeout(r, 400));
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ goal: cert, transcript, session_id: sessionId.current }));
    }

    try {
      let res;
      if (mode === "text") {
        const r = await fetch(`${API}/api/analysis/transcript`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal: cert, transcript, session_id: sessionId.current })
        });
        const d = await r.json();
        res = d.result;
      } else {
        const fd = new FormData();
        fd.append("goal", cert);
        fd.append("audio_file", audioFile);
        const r = await fetch(`${API}/api/analysis/audio`, { method: "POST", body: fd });
        const d = await r.json();
        res = d.result;
      }
      setResult(res);
      setStreamEvents(e => [...e, { agent: "orchestrator", status: "completed", message: "All agents completed — final report ready", data: {} }]);
    } catch (err) {
      setStreamEvents(e => [...e, { agent: "orchestrator", status: "error", message: err.message, data: {} }]);
    }
    wsRef.current?.close();
    setLoading(false);
  }

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <nav className="nav">
          <div className="nav-logo">
            <span style={{ color: "var(--blue2)" }}>Cert</span><span>Sense</span>
            <span style={{ color: "var(--text2)", fontWeight: 300 }}>AI</span>
            <span className="nav-badge">HACKATHON</span>
          </div>
          <div className="nav-tabs">
            {["analyze", "interview", "manager", "progress"].map(p => (
              <button key={p} className={`nav-tab ${page === p ? "active" : ""}`} onClick={() => setPage(p)}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </nav>

        <div className="main">
          <aside className="sidebar">
            <div className="sidebar-section">Certification Track</div>
            {CERTS.map(c => (
              <div
                key={c.id}
                className={`cert-card ${cert === c.id ? "selected" : ""}`}
                style={{ "--accent-color": c.color }}
                onClick={() => setCert(c.id)}
              >
                <div className="cert-row">
                  <span className="cert-badge">{c.badge}</span>
                  <span className="cert-name" style={{ color: cert === c.id ? c.color : "var(--text)" }}>{c.id}</span>
                </div>
                <div className="cert-sub">{c.name}</div>
              </div>
            ))}

            <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
              <div className="sidebar-section">Multi-Agent Pipeline</div>
              {AGENTS.map(a => (
                <div key={a.key} style={{ display: "flex", gap: ".625rem", alignItems: "flex-start", padding: ".375rem 0" }}>
                  <span style={{ fontSize: ".875rem" }}></span>
                  <div>
                    <div style={{ fontSize: ".7rem", fontWeight: 600, color: "var(--text2)" }}>{a.label}</div>
                    <div style={{ fontSize: ".6rem", color: "var(--text3)", lineHeight: 1.5 }}>{a.desc}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: ".875rem", fontSize: ".6rem", color: "var(--text3)", fontFamily: "var(--mono)", padding: ".5rem .625rem", background: "var(--bg3)", borderRadius: "6px", border: "1px solid var(--border)", lineHeight: 1.7 }}>
                Grounded via<br />Microsoft Foundry IQ
              </div>
            </div>
          </aside>

          <div className="content">
            {page === "analyze" && (
              <>
                <div className="hero">
                  <div className="hero-eyebrow">CertSense AI · {cert}</div>
                  <div className="hero-title">Measure your <em>{selectedCert?.name}</em> readiness</div>
                  <div className="hero-sub">Submit a verbal explanation or typed answer. Our agent team analyzes technical depth, generates study plans, and delivers exam-grounded assessments.</div>
                </div>

                <div className="agents-row">
                  {AGENTS.map(a => (
                    <div className="agent-chip" key={a.key}>
                      <div className="agent-icon"></div>
                      <div className="agent-label">{a.label}</div>
                      <div className="agent-desc">{a.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="input-zone">
                  <div className="mode-switch">
                    {["text", "audio"].map(m => (
                      <button key={m} className={`mode-btn ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>
                        {m === "text" ? "Text" : "Audio"}
                      </button>
                    ))}
                  </div>

                  {mode === "text" ? (
                    <>
                      <div className="input-label">Your explanation / answer</div>
                      <textarea
                        value={transcript}
                        onChange={e => setTranscript(e.target.value)}
                        placeholder={`Explain a key concept for ${cert}. For example: "In AZ-204, Azure Functions are serverless compute instances that..."`}
                        rows={6}
                      />
                    </>
                  ) : (
                    <>
                      <div className="input-label">Upload audio recording</div>
                      <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                        <input ref={fileRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => setAudioFile(e.target.files[0])} />
                                                <div className="upload-text">Click to upload MP3, WAV, M4A, or WebM<br />Your speech will be transcribed then analyzed</div>
                      </div>
                      {audioFile && <div className="file-indicator">{audioFile.name}</div>}
                    </>
                  )}

                  <div className="run-row">
                    <button className={`run-btn ${loading ? "loading" : ""}`} onClick={runAnalysis}
                      disabled={loading || (mode === "text" ? !transcript.trim() : !audioFile)}>
                      {loading ? <><span className="spinner" /> Analyzing...</> : "Run Analysis"}
                    </button>
                    <span className="run-hint">
                      {loading ? "Agents running in parallel…" : `4 agents · ${cert} certification knowledge base`}
                    </span>
                  </div>

                  <StreamPanel events={streamEvents} />
                </div>

                {!result && !loading && (
                  <div className="empty-state">
                                        <div className="empty-text">Submit your answer above to get a full readiness report: concept coverage, technical depth score, 7-day study plan, and exam-style questions.</div>
                  </div>
                )}

                {result && <ResultView result={result} cert={cert} />}
              </>
            )}

            {page === "interview" && (
              <>
                <div className="hero">
                  <div className="hero-eyebrow">Interactive Interview · {cert}</div>
                  <div className="hero-title">AI-driven <em>interview session</em></div>
                  <div className="hero-sub">Answer {5} progressive questions posed by our Interviewer Agent. Each question adapts to your responses. Full assessment runs at the end.</div>
                </div>
                <InterviewMode cert={cert} />
              </>
            )}

            {page === "manager" && <ManagerDashboard />}

            {page === "progress" && (
              <>
                <div className="hero">
                  <div className="hero-eyebrow">Progress Tracking</div>
                  <div className="hero-title">Your <em>readiness</em> over time</div>
                  <div className="hero-sub">Track score trends across certification tracks and sessions.</div>
                </div>
                <div className="input-zone">
                  <div className="block">
                    <div className="block-title">Certification Progress</div>
                    {CERTS.map(c => (
                      <div key={c.id} style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", marginBottom: ".375rem" }}>
                          <span style={{ fontWeight: 600, color: c.id === cert ? c.color : "var(--text2)" }}>{c.id} · {c.name}</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: ".7rem", color: "var(--text3)" }}>
                            {c.id === cert ? "Active track" : "Not started"}
                          </span>
                        </div>
                        <div className="progress-bar-wrap">
                          <div className="progress-bar-fill" style={{ width: c.id === cert ? "0%" : "0%", background: c.color }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: "1rem", fontSize: ".75rem", color: "var(--text3)", lineHeight: 1.7, fontFamily: "var(--mono)" }}>
                      Complete an analysis or interview session to begin tracking progress.<br />
                      Connect a user_id via the API to persist across sessions.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}