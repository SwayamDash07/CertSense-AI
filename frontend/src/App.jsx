import { useState, useRef, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const CERTS = [
  { id: "AZ-204", label: "AZ-204", name: "Azure Developer", color: "#3b82f6", badge: "DEV" },
  { id: "AZ-400", label: "AZ-400", name: "DevOps Engineer", color: "#8b5cf6", badge: "OPS" },
  { id: "DP-203", label: "DP-203", name: "Data Engineer", color: "#06b6d4", badge: "DATA" },
];

const AGENTS = [
  { key: "readiness_coach", label: "Readiness Coach", icon: "--", desc: "Evaluates concept coverage & depth" },
  { key: "study_plan", label: "Study Planner", icon: "--", desc: "Generates 7-day personalized plan" },
  { key: "assessment", label: "Assessment Engine", icon: "--", desc: "Exam-style grounded questions" },
  { key: "insights", label: "Progress Insights", icon: "--", desc: "Long-term readiness analytics" },
];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600&display=swap');

  *{box-sizing:border-box;margin:0;padding:0}

  :root{
    --bg:#000308;
    --bg2:#020b18;
    --bg3:#040f20;
    --bg4:#071528;
    --bg5:#0a1c35;
    --border:#0d2540;
    --border2:#1a3d5c;
    --border3:#2a5f8a;
    --blue:#1d6cf0;
    --blue2:#4d9fff;
    --blue3:#0a3d8f;
    --blue4:#0066ff;
    --glow:#1d6cf088;
    --cyan:#00d4ff;
    --cyan2:#00aacc;
    --purple:#7c3aed;
    --green:#00ff88;
    --green2:#00cc6a;
    --red:#ff3355;
    --amber:#ffaa00;
    --text:#e8f4ff;
    --text2:#7aaed4;
    --text3:#2d5a7a;
    --font:'Space Grotesk',sans-serif;
    --mono:'JetBrains Mono',monospace;
  }

  body{
    background:var(--bg);
    color:var(--text);
    font-family:var(--font);
    min-height:100vh;
    overflow-x:hidden;
  }

  /* ── Background grid + glow ───────────────────────────────── */
  body::before{
    content:'';
    position:fixed;
    inset:0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(29,108,240,.03) 1px, transparent 1px);
    background-size:40px 40px;
    pointer-events:none;
    z-index:0;
  }
  body::after{
    content:'';
    position:fixed;
    top:-20%;
    left:50%;
    transform:translateX(-50%);
    width:800px;
    height:400px;
    background:radial-gradient(ellipse, rgba(29,108,240,.08) 0%, transparent 70%);
    pointer-events:none;
    z-index:0;
  }

  .app{
    display:grid;
    grid-template-rows:58px 1fr;
    min-height:100vh;
    position:relative;
    z-index:1;
  }

  /* ── Nav ──────────────────────────────────────────────────── */
  .nav{
    background:rgba(1, 3, 66, 0.85);
    backdrop-filter:blur(20px);
    border-bottom:1px solid var(--border);
    display:flex;
    align-items:center;
    padding:0 2rem;
    gap:1.5rem;
    position:sticky;
    top:0;
    z-index:100;
    box-shadow:0 1px 0 rgba(29,108,240,.1), 0 4px 20px rgba(0,0,0,.4);
  }
  .nav::after{
    content:'';
    position:absolute;
    bottom:0;
    left:0;
    right:0;
    height:1px;
    background:linear-gradient(90deg, transparent, rgba(29,108,240,.4), rgba(0,212,255,.3), transparent);
  }

  .nav-logo{
    font-size:1.05rem;
    font-weight:700;
    letter-spacing:-.02em;
    color:var(--text);
    display:flex;
    align-items:center;
    gap:.375rem;
  }
  .nav-logo .logo-cert{
    color:var(--blue2);
    font-weight:700;
  }
  .nav-logo .logo-sense{
    color:var(--text);
    font-weight:300;
  }
  .nav-logo .logo-ai{
    color:var(--cyan);
    font-weight:700;
  }
  .nav-badge{
    font-size:.55rem;
    font-family:var(--mono);
    background:linear-gradient(135deg,rgba(29,108,240,.2),rgba(0,212,255,.1));
    color:var(--cyan);
    padding:2px 8px;
    border-radius:3px;
    letter-spacing:.1em;
    border:1px solid rgba(0,212,255,.2);
    text-transform:uppercase;
  }

  .nav-tabs{display:flex;gap:2px;margin-left:auto}
  .nav-tab{
    background:none;
    border:none;
    color:var(--text3);
    font-family:var(--font);
    font-size:.78rem;
    padding:7px 14px;
    border-radius:6px;
    cursor:pointer;
    transition:all .2s;
    font-weight:500;
    letter-spacing:.02em;
    position:relative;
  }
  .nav-tab:hover{color:var(--text2);background:rgba(29,108,240,.06)}
  .nav-tab.active{
    color:var(--blue2);
    background:rgba(29,108,240,.1);
    border:1px solid rgba(29,108,240,.2);
  }
  .nav-tab.active::after{
    content:'';
    position:absolute;
    bottom:-1px;
    left:20%;
    right:20%;
    height:1px;
    background:var(--blue2);
    box-shadow:0 0 8px var(--blue2);
  }

  /* ── Layout ───────────────────────────────────────────────── */
  .main{
    display:grid;
    grid-template-columns:256px 1fr;
    overflow:hidden;
    height:calc(100vh - 58px);
    min-height:0;
  }

  /* ── Sidebar ──────────────────────────────────────────────── */
  .sidebar{
    background:var(--bg2);
    border-right:1px solid var(--border);
    padding:1.25rem .875rem;
    overflow-y:auto;
    display:flex;
    flex-direction:column;
    gap:.875rem;
    scrollbar-width:thin;
    scrollbar-color:var(--border2) transparent;
  }
  .sidebar-section{
    font-size:.58rem;
    font-family:var(--mono);
    color:var(--text3);
    letter-spacing:.15em;
    text-transform:uppercase;
    padding:0 .25rem;
    margin-bottom:.125rem;
  }

  .cert-card{
    background:var(--bg3);
    border:1px solid var(--border);
    border-radius:10px;
    padding:.75rem .875rem;
    cursor:pointer;
    transition:all .25s cubic-bezier(.4,0,.2,1);
    position:relative;
    overflow:hidden;
  }
  .cert-card::before{
    content:'';
    position:absolute;
    top:0;left:0;right:0;
    height:2px;
    background:linear-gradient(90deg, var(--accent-color,var(--blue)), var(--cyan));
    opacity:0;
    transition:opacity .25s;
  }
  .cert-card::after{
    content:'';
    position:absolute;
    inset:0;
    background:radial-gradient(circle at 0% 50%, rgba(29,108,240,.04) 0%, transparent 60%);
    opacity:0;
    transition:opacity .3s;
  }
  .cert-card:hover{
    border-color:var(--border2);
    background:var(--bg4);
    transform:translateX(2px);
  }
  .cert-card:hover::after{opacity:1}
  .cert-card.selected{
    border-color:var(--accent-color,var(--blue));
    background:var(--bg4);
    box-shadow:0 0 20px rgba(29,108,240,.08), inset 0 0 20px rgba(29,108,240,.04);
  }
  .cert-card.selected::before{opacity:1}

  .cert-row{display:flex;align-items:center;gap:.5rem}
  .cert-badge{
    font-size:.58rem;
    font-family:var(--mono);
    font-weight:600;
    padding:2px 7px;
    border-radius:4px;
    letter-spacing:.06em;
    background:rgba(29,108,240,.12);
    color:var(--blue2);
    border:1px solid rgba(29,108,240,.2);
  }
  .cert-name{font-size:.72rem;font-weight:600;letter-spacing:.01em}
  .cert-sub{font-size:.62rem;color:var(--text3);margin-top:2px}

  /* ── Agent pipeline sidebar ───────────────────────────────── */
  .agent-chip{
    background:var(--bg3);
    border:1px solid var(--border);
    border-radius:8px;
    padding:.625rem .75rem;
    transition:all .2s;
    position:relative;
    overflow:hidden;
  }
  .agent-chip::before{
    content:'';
    position:absolute;
    left:0;top:0;bottom:0;
    width:2px;
    background:linear-gradient(180deg,var(--blue),var(--cyan));
    opacity:.3;
  }
  .agent-label{font-size:.68rem;font-weight:600;color:var(--text2);letter-spacing:.01em}
  .agent-desc{font-size:.6rem;color:var(--text3);line-height:1.4;margin-top:1px}

  .grounded-badge{
    background:linear-gradient(135deg,rgba(0,212,255,.05),rgba(29,108,240,.08));
    border:1px solid rgba(0,212,255,.15);
    border-radius:8px;
    padding:.625rem .875rem;
    font-size:.65rem;
    font-family:var(--mono);
    color:var(--cyan2);
    display:flex;
    align-items:center;
    gap:.5rem;
    margin-top:auto;
  }
  .grounded-badge::before{
    content:'';
    width:6px;height:6px;
    border-radius:50%;
    background:var(--cyan);
    box-shadow:0 0 6px var(--cyan);
    flex-shrink:0;
    animation:glow-pulse 2s ease-in-out infinite;
  }
  @keyframes glow-pulse{
    0%,100%{box-shadow:0 0 4px var(--cyan);opacity:1}
    50%{box-shadow:0 0 10px var(--cyan),0 0 20px rgba(0,212,255,.3);opacity:.8}
  }

  /* ── Content ──────────────────────────────────────────────── */
  .content{
    overflow-y:auto;
    display:flex;
    flex-direction:column;
    scrollbar-width:thin;
    scrollbar-color:var(--border2) transparent;
  }

  /* ── Hero ─────────────────────────────────────────────────── */
  .hero{
    padding:2.5rem 2.5rem 2rem;
    border-bottom:1px solid var(--border);
    background:linear-gradient(180deg, rgba(4,15,32,.8) 0%, transparent 100%);
    position:relative;
    overflow:visible;
    flex-shrink:0;
    animation:hero-in .5s ease both;
  }
  .hero::before{
    content:'';
    position:absolute;
    top:0;right:0;
    width:40%;height:100%;
    background:radial-gradient(ellipse at right top, rgba(29,108,240,.06), transparent 70%);
    pointer-events:none;
  }
  @keyframes hero-in{
    from{opacity:0;transform:translateY(-8px)}
    to{opacity:1;transform:translateY(0)}
  }

  .hero-eyebrow{
    font-size:.62rem;
    font-family:var(--mono);
    color:var(--cyan);
    letter-spacing:.18em;
    text-transform:uppercase;
    margin-bottom:.875rem;
    display:flex;
    align-items:center;
    gap:.625rem;
    animation:fade-up .4s .1s ease both;
  }
  .hero-eyebrow::before{
    content:'';
    display:inline-block;
    width:20px;height:1px;
    background:var(--cyan);
    box-shadow:0 0 6px var(--cyan);
  }
  .hero-title{
    font-size:2.1rem;
    font-weight:700;
    line-height:1.1;
    letter-spacing:-.04em;
    margin-bottom:.625rem;
    animation:fade-up .4s .15s ease both;
  }
  .hero-title em{
    font-style:normal;
    background:linear-gradient(135deg,var(--blue2),var(--cyan));
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }
  .hero-sub{
    font-size:.85rem;
    color:var(--text2);
    line-height:1.65;
    max-width:520px;
    font-weight:300;
    animation:fade-up .4s .2s ease both;
  }

  @keyframes fade-up{
    from{opacity:0;transform:translateY(10px)}
    to{opacity:1;transform:translateY(0)}
  }

  /* ── Input zone ───────────────────────────────────────────── */
  .input-zone{
    padding:1.75rem 2.5rem;
    border-bottom:1px solid var(--border);
  }
  .input-label{
    font-size:.62rem;
    font-family:var(--mono);
    color:var(--text3);
    letter-spacing:.1em;
    text-transform:uppercase;
    margin-bottom:.75rem;
    display:flex;
    align-items:center;
    gap:.5rem;
  }

  .mode-switch{
    display:flex;
    background:var(--bg3);
    border:1px solid var(--border);
    border-radius:8px;
    padding:3px;
    gap:2px;
    width:fit-content;
    margin-bottom:1.25rem;
  }
  .mode-btn{
    background:none;
    border:none;
    color:var(--text3);
    font-family:var(--font);
    font-size:.75rem;
    padding:5px 16px;
    border-radius:5px;
    cursor:pointer;
    transition:all .2s;
    font-weight:500;
  }
  .mode-btn.active{
    background:rgba(29,108,240,.15);
    color:var(--blue2);
    border:1px solid rgba(29,108,240,.25);
    box-shadow:0 0 12px rgba(29,108,240,.1);
  }

  textarea{
    width:100%;
    background:rgba(4,15,32,.6);
    border:1px solid var(--border2);
    color:var(--text);
    font-family:var(--mono);
    font-size:.8rem;
    border-radius:10px;
    padding:1rem 1.125rem;
    resize:vertical;
    min-height:130px;
    outline:none;
    transition:all .2s;
    line-height:1.7;
    backdrop-filter:blur(4px);
  }
  textarea:focus{
    border-color:var(--blue);
    box-shadow:0 0 0 3px rgba(29,108,240,.08), 0 0 20px rgba(29,108,240,.05);
    background:rgba(4,15,32,.8);
  }
  textarea::placeholder{color:var(--text3)}

  .run-row{
    display:flex;
    align-items:center;
    gap:1rem;
    margin-top:1.125rem;
  }
  .run-btn{
    background:linear-gradient(135deg,var(--blue3),var(--blue4));
    color:#fff;
    border:none;
    font-family:var(--font);
    font-size:.875rem;
    font-weight:600;
    padding:.75rem 2rem;
    border-radius:8px;
    cursor:pointer;
    transition:all .2s;
    display:flex;
    align-items:center;
    gap:.5rem;
    letter-spacing:.02em;
    position:relative;
    overflow:hidden;
    box-shadow:0 4px 20px rgba(29,108,240,.25);
  }
  .run-btn::before{
    content:'';
    position:absolute;
    top:0;left:-100%;
    width:100%;height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);
    transition:left .4s;
  }
  .run-btn:hover{
    background:linear-gradient(135deg,var(--blue4),var(--blue2));
    box-shadow:0 6px 30px rgba(29,108,240,.4), 0 0 20px rgba(29,108,240,.2);
    transform:translateY(-1px);
  }
  .run-btn:hover::before{left:100%}
  .run-btn:disabled{opacity:.35;cursor:not-allowed;box-shadow:none;transform:none}
  .run-hint{font-size:.7rem;color:var(--text3);font-family:var(--mono)}

  /* ── Stream panel ─────────────────────────────────────────── */
  .stream-panel{
    background:rgba(0,3,8,.8);
    border:1px solid var(--border);
    border-radius:10px;
    padding:1rem 1.125rem;
    font-family:var(--mono);
    font-size:.7rem;
    line-height:1.9;
    color:var(--text2);
    max-height:220px;
    overflow-y:auto;
    margin-bottom:1rem;
    scrollbar-width:thin;
    scrollbar-color:var(--border2) transparent;
    position:relative;
  }
  .stream-panel::before{
    content:'AGENT STREAM';
    position:absolute;
    top:.625rem;right:.875rem;
    font-size:.52rem;
    color:var(--text3);
    letter-spacing:.15em;
  }
  .stream-line{
    display:flex;
    gap:.75rem;
    align-items:flex-start;
    animation:stream-in .2s ease both;
  }
  @keyframes stream-in{
    from{opacity:0;transform:translateX(-4px)}
    to{opacity:1;transform:translateX(0)}
  }
  .stream-agent{
    color:var(--blue2);
    min-width:100px;
    font-weight:500;
  }
  .stream-status{color:var(--green);font-weight:600}
  .stream-status.thinking{
    color:var(--amber);
    animation:thinking-pulse .8s ease-in-out infinite alternate;
  }
  @keyframes thinking-pulse{
    from{opacity:.6}to{opacity:1}
  }
  .stream-status.error{color:var(--red)}

  /* ── Results ──────────────────────────────────────────────── */
  .results{padding:1.75rem 2.5rem;flex:1}

  .result-tabs{
    display:flex;
    gap:3px;
    margin-bottom:1.75rem;
    border-bottom:1px solid var(--border);
    padding-bottom:.625rem;
  }
  .result-tab{
    background:none;
    border:none;
    color:var(--text3);
    font-family:var(--font);
    font-size:.75rem;
    padding:6px 16px;
    border-radius:6px;
    cursor:pointer;
    transition:all .2s;
    font-weight:500;
    letter-spacing:.02em;
  }
  .result-tab:hover{color:var(--text2);background:rgba(29,108,240,.06)}
  .result-tab.active{
    color:var(--blue2);
    background:rgba(29,108,240,.1);
    border:1px solid rgba(29,108,240,.2);
    box-shadow:0 0 10px rgba(29,108,240,.08);
  }

  /* ── Score cards ──────────────────────────────────────────── */
  .score-grid{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:.875rem;
    margin-bottom:1.75rem;
  }
  .score-card{
    background:var(--bg3);
    border:1px solid var(--border);
    border-radius:12px;
    padding:1.125rem;
    position:relative;
    overflow:hidden;
    transition:all .25s;
    animation:card-in .4s ease both;
  }
  .score-card:hover{
    border-color:var(--border2);
    transform:translateY(-2px);
    box-shadow:0 8px 24px rgba(0,0,0,.3);
  }
  .score-card::before{
    content:'';
    position:absolute;
    top:0;left:0;right:0;
    height:1px;
    background:linear-gradient(90deg,transparent,var(--accent,var(--blue2)),transparent);
    opacity:.4;
  }
  .score-card::after{
    content:attr(data-score);
    position:absolute;
    right:14px;top:12px;
    font-size:1.6rem;
    font-weight:700;
    font-family:var(--mono);
    color:var(--accent,var(--blue2));
    opacity:.08;
  }
  @keyframes card-in{
    from{opacity:0;transform:translateY(8px)}
    to{opacity:1;transform:translateY(0)}
  }
  .score-label{
    font-size:.6rem;
    font-family:var(--mono);
    color:var(--text3);
    letter-spacing:.1em;
    text-transform:uppercase;
    margin-bottom:.5rem;
  }
  .score-val{
    font-size:2.1rem;
    font-weight:700;
    font-family:var(--mono);
    color:var(--accent,var(--blue2));
    line-height:1;
    text-shadow:0 0 20px var(--accent,rgba(77,159,255,.3));
  }
  .score-bar{
    height:2px;
    background:var(--border);
    border-radius:2px;
    margin-top:.75rem;
    overflow:hidden;
  }
  .score-fill{
    height:100%;
    border-radius:2px;
    background:linear-gradient(90deg,var(--accent,var(--blue3)),var(--accent,var(--blue2)));
    transition:width 1.2s cubic-bezier(.4,0,.2,1);
    box-shadow:0 0 8px var(--accent,rgba(29,108,240,.4));
  }

  /* ── Blocks ───────────────────────────────────────────────── */
  .block{
    background:var(--bg3);
    border:1px solid var(--border);
    border-radius:12px;
    padding:1.375rem;
    margin-bottom:1rem;
    transition:border .2s;
    animation:card-in .4s ease both;
  }
  .block:hover{border-color:var(--border2)}
  .block-title{
    font-size:.62rem;
    font-family:var(--mono);
    color:var(--text3);
    letter-spacing:.12em;
    text-transform:uppercase;
    margin-bottom:1rem;
    display:flex;
    align-items:center;
    gap:.625rem;
  }
  .block-title::before{
    content:'';
    display:inline-block;
    width:6px;height:6px;
    border-radius:50%;
    background:var(--blue2);
    box-shadow:0 0 6px var(--blue2);
  }

  /* ── Tags ─────────────────────────────────────────────────── */
  .prose{font-size:.8rem;color:var(--text2);line-height:1.7}
  .tag-row{display:flex;flex-wrap:wrap;gap:.375rem;margin-top:.625rem}
  .tag{
    font-size:.62rem;
    font-family:var(--mono);
    padding:3px 9px;
    border-radius:4px;
    background:rgba(29,108,240,.08);
    color:var(--blue2);
    border:1px solid rgba(29,108,240,.15);
    transition:all .15s;
  }
  .tag:hover{background:rgba(29,108,240,.15);border-color:rgba(29,108,240,.3)}
  .tag.green{background:rgba(0,255,136,.06);color:var(--green);border-color:rgba(0,255,136,.15)}
  .tag.amber{background:rgba(255,170,0,.08);color:var(--amber);border-color:rgba(255,170,0,.2)}
  .tag.red{background:rgba(255,51,85,.08);color:var(--red);border-color:rgba(255,51,85,.2)}

  /* ── Study plan ───────────────────────────────────────────── */
  .plan-day{
    background:rgba(4,15,32,.6);
    border:1px solid var(--border);
    border-radius:10px;
    padding:.875rem 1rem;
    margin-bottom:.625rem;
    display:flex;
    gap:1rem;
    align-items:flex-start;
    transition:all .2s;
    animation:card-in .3s ease both;
  }
  .plan-day:hover{border-color:var(--border2);background:var(--bg3)}
  .plan-day-num{
    font-family:var(--mono);
    font-size:.6rem;
    color:var(--blue2);
    background:rgba(29,108,240,.1);
    padding:4px 9px;
    border-radius:5px;
    white-space:nowrap;
    border:1px solid rgba(29,108,240,.2);
    font-weight:600;
    letter-spacing:.06em;
    box-shadow:0 0 10px rgba(29,108,240,.1);
  }
  .plan-day-content{font-size:.78rem;color:var(--text2);line-height:1.6;flex:1}

  /* ── Question blocks ──────────────────────────────────────── */
  .q-block{
    background:rgba(4,15,32,.6);
    border:1px solid var(--border);
    border-radius:10px;
    padding:1.125rem;
    margin-bottom:.875rem;
    transition:all .2s;
    animation:card-in .3s ease both;
  }
  .q-block:hover{border-color:var(--border2)}
  .q-number{
    font-family:var(--mono);
    font-size:.58rem;
    color:var(--text3);
    margin-bottom:.5rem;
    letter-spacing:.08em;
  }
  .q-text{
    font-size:.82rem;
    font-weight:500;
    color:var(--text);
    margin-bottom:.75rem;
    line-height:1.55;
  }
  .q-option{
    font-size:.75rem;
    color:var(--text2);
    padding:5px 0;
    display:flex;
    gap:.625rem;
  }
  .q-option span:first-child{color:var(--text3);font-family:var(--mono);min-width:16px}

  .citation-row{
    display:flex;
    align-items:center;
    gap:.375rem;
    margin-top:.625rem;
    font-size:.62rem;
    color:var(--text3);
    font-family:var(--mono);
  }
  .citation-dot{
    width:5px;height:5px;
    border-radius:50%;
    background:var(--cyan);
    box-shadow:0 0 4px var(--cyan);
  }

  /* ── Rec box ──────────────────────────────────────────────── */
  .rec-box{
    background:linear-gradient(135deg,rgba(29,108,240,.08),rgba(0,212,255,.04));
    border:1px solid rgba(29,108,240,.2);
    border-radius:12px;
    padding:1.375rem;
    font-size:.82rem;
    color:var(--text);
    line-height:1.7;
    position:relative;
    overflow:hidden;
  }
  .rec-box::before{
    content:'';
    position:absolute;
    top:0;left:0;right:0;
    height:1px;
    background:linear-gradient(90deg,transparent,var(--blue2),var(--cyan),transparent);
  }

  /* ── Interview ────────────────────────────────────────────── */
  .interview-q{
    font-size:1rem;
    font-weight:600;
    line-height:1.55;
    margin-bottom:1.375rem;
    color:var(--text);
    padding:1.25rem;
    background:rgba(29,108,240,.05);
    border:1px solid rgba(29,108,240,.15);
    border-radius:10px;
    border-left:3px solid var(--blue2);
    animation:fade-up .3s ease both;
  }
  .interview-round{
    font-size:.62rem;
    font-family:var(--mono);
    color:var(--text3);
    margin-bottom:1rem;
    letter-spacing:.08em;
    display:flex;
    align-items:center;
    gap:.5rem;
  }
  .interview-round::before{
    content:'';
    display:inline-block;
    width:8px;height:1px;
    background:var(--blue);
  }

  /* ── Upload zone ──────────────────────────────────────────── */
  .upload-zone{
    border:1.5px dashed var(--border2);
    border-radius:12px;
    padding:2.5rem;
    text-align:center;
    cursor:pointer;
    transition:all .25s;
    background:rgba(4,15,32,.4);
    position:relative;
    overflow:hidden;
  }
  .upload-zone:hover{
    border-color:var(--blue);
    background:rgba(29,108,240,.04);
    box-shadow:0 0 30px rgba(29,108,240,.06);
  }
  .upload-text{font-size:.8rem;color:var(--text3);line-height:1.6}
  .file-indicator{
    display:flex;
    align-items:center;
    gap:.5rem;
    font-size:.75rem;
    color:var(--green);
    font-family:var(--mono);
    margin-top:.75rem;
    padding:.5rem .875rem;
    background:rgba(0,255,136,.05);
    border:1px solid rgba(0,255,136,.15);
    border-radius:6px;
    width:fit-content;
    box-shadow:0 0 10px rgba(0,255,136,.05);
  }

  /* ── Spinner ──────────────────────────────────────────────── */
  .spinner{
    width:16px;height:16px;
    border:2px solid var(--border2);
    border-top-color:var(--blue2);
    border-right-color:var(--cyan);
    border-radius:50%;
    animation:spin .6s linear infinite;
    display:inline-block;
    box-shadow:0 0 8px rgba(29,108,240,.2);
  }
  @keyframes spin{to{transform:rotate(360deg)}}

  .empty-state{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    padding:4rem 2rem;
    color:var(--text3);
    text-align:center;
    gap:.875rem;
  }
  .empty-text{font-size:.875rem;line-height:1.6;max-width:320px;color:var(--text3)}

  /* ── Progress bars ────────────────────────────────────────── */
  .progress-bar-wrap{
    background:var(--border);
    border-radius:100px;
    height:5px;
    overflow:hidden;
    margin:.375rem 0;
  }
  .progress-bar-fill{
    height:100%;
    border-radius:100px;
    background:linear-gradient(90deg,var(--blue3),var(--blue2));
    transition:width .8s cubic-bezier(.4,0,.2,1);
    box-shadow:0 0 6px rgba(29,108,240,.3);
  }

  /* ── Manager ──────────────────────────────────────────────── */
  .mgr-grid{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:.875rem;
    padding:1.75rem 2.5rem;
    border-bottom:1px solid var(--border);
  }
  .mgr-stat{
    background:var(--bg3);
    border:1px solid var(--border);
    border-radius:12px;
    padding:1.125rem;
    transition:all .2s;
    position:relative;
    overflow:hidden;
  }
  .mgr-stat:hover{border-color:var(--border2);transform:translateY(-2px)}
  .mgr-stat::before{
    content:'';
    position:absolute;
    bottom:0;left:0;right:0;
    height:1px;
    background:linear-gradient(90deg,transparent,rgba(29,108,240,.3),transparent);
    opacity:0;
    transition:opacity .2s;
  }
  .mgr-stat:hover::before{opacity:1}
  .mgr-stat-val{
    font-size:1.75rem;
    font-weight:700;
    font-family:var(--mono);
    margin-bottom:2px;
    text-shadow:0 0 15px currentColor;
  }
  .mgr-stat-label{
    font-size:.6rem;
    font-family:var(--mono);
    color:var(--text3);
    letter-spacing:.1em;
    text-transform:uppercase;
  }

  .mgr-body{padding:1.75rem 2.5rem;display:flex;flex-direction:column;gap:1rem}
  .learner-table{width:100%;border-collapse:collapse}
  .learner-table th{
    font-size:.6rem;
    font-family:var(--mono);
    color:var(--text3);
    letter-spacing:.1em;
    text-transform:uppercase;
    padding:.5rem .875rem;
    text-align:left;
    border-bottom:1px solid var(--border);
    font-weight:500;
  }
  .learner-table td{
    font-size:.75rem;
    padding:.625rem .875rem;
    border-bottom:1px solid var(--border);
    color:var(--text2);
    vertical-align:middle;
    transition:background .15s;
  }
  .learner-table tr:last-child td{border-bottom:none}
  .learner-table tr:hover td{background:rgba(29,108,240,.04)}

  .risk-badge{font-size:.58rem;font-family:var(--mono);padding:2px 8px;border-radius:4px;font-weight:600;white-space:nowrap}
  .risk-low{background:rgba(0,255,136,.06);color:var(--green);border:1px solid rgba(0,255,136,.15)}
  .risk-medium{background:rgba(255,170,0,.08);color:var(--amber);border:1px solid rgba(255,170,0,.2)}
  .risk-high{background:rgba(255,51,85,.08);color:var(--red);border:1px solid rgba(255,51,85,.2)}
  .risk-critical{background:rgba(255,51,85,.15);color:#ff6b6b;border:1px solid rgba(255,51,85,.35)}
  .outcome-pass{color:var(--green);font-weight:600;font-family:var(--mono);font-size:.7rem}
  .outcome-fail{color:var(--red);font-weight:600;font-family:var(--mono);font-size:.7rem}
  .mini-bar-wrap{width:80px;height:3px;background:var(--border);border-radius:2px;overflow:hidden;display:inline-block;vertical-align:middle;margin-left:.5rem}
  .mini-bar-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--blue3),var(--blue2));transition:width .8s ease;box-shadow:0 0 4px rgba(29,108,240,.3)}
  .team-chip{font-size:.58rem;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:rgba(29,108,240,.06);color:var(--text3);border:1px solid var(--border)}
  .insight-card{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:1.125rem 1.25rem;display:flex;gap:1rem;align-items:flex-start;transition:all .2s}
  .insight-card:hover{border-color:var(--border2)}
  .insight-title{font-size:.75rem;font-weight:600;color:var(--text);margin-bottom:.25rem}
  .insight-body{font-size:.72rem;color:var(--text2);line-height:1.6}
  .team-filter{display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:1rem}
  .team-filter-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text3);font-family:var(--mono);font-size:.62rem;padding:4px 10px;border-radius:5px;cursor:pointer;transition:all .15s}
  .team-filter-btn:hover{border-color:var(--border2);color:var(--text2)}
  .team-filter-btn.active{background:rgba(29,108,240,.1);border-color:rgba(29,108,240,.3);color:var(--blue2)}

  /* ── Practice Paper ───────────────────────────────────────── */
  .paper-config{padding:2.5rem 2.5rem;display:flex;flex-direction:column;gap:1.75rem;max-width:580px}
  .config-label{font-size:.6rem;font-family:var(--mono);color:var(--text3);letter-spacing:.12em;text-transform:uppercase;margin-bottom:.75rem}
  .config-row{display:flex;gap:.5rem;flex-wrap:wrap}
  .config-btn{
    background:var(--bg3);
    border:1px solid var(--border);
    color:var(--text2);
    font-family:var(--mono);
    font-size:.72rem;
    padding:8px 18px;
    border-radius:8px;
    cursor:pointer;
    transition:all .2s;
    font-weight:500;
    line-height:1.4;
  }
  .config-btn:hover{border-color:var(--border2);color:var(--text);background:var(--bg4)}
  .config-btn.active{
    background:rgba(29,108,240,.12);
    border-color:rgba(29,108,240,.35);
    color:var(--blue2);
    box-shadow:0 0 15px rgba(29,108,240,.1);
  }
  .paper-wrap{padding:1.75rem 2.5rem;flex:1;display:flex;flex-direction:column;gap:1rem}
  .paper-header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:.875rem 1.25rem;
    background:rgba(4,15,32,.6);
    border:1px solid var(--border);
    border-radius:10px;
    backdrop-filter:blur(4px);
  }
  .paper-meta{font-size:.68rem;font-family:var(--mono);color:var(--text3)}
  .paper-timer{font-size:1.15rem;font-weight:700;font-family:var(--mono);color:var(--blue2);text-shadow:0 0 15px rgba(77,159,255,.3)}
  .paper-timer.warning{color:var(--amber);text-shadow:0 0 15px rgba(255,170,0,.3)}
  .paper-timer.danger{color:var(--red);text-shadow:0 0 15px rgba(255,51,85,.4);animation:pulse 1s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  .pq-block{background:rgba(4,15,32,.6);border:1px solid var(--border);border-radius:12px;padding:1.375rem;transition:all .2s;animation:card-in .3s ease both}
  .pq-block:hover{border-color:var(--border2)}
  .pq-block.answered{border-color:rgba(29,108,240,.3);box-shadow:0 0 15px rgba(29,108,240,.04)}
  .pq-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
  .pq-num{font-size:.62rem;font-family:var(--mono);color:var(--text3);letter-spacing:.08em}
  .pq-difficulty{font-size:.58rem;font-family:var(--mono);padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.08em;font-weight:600}
  .pq-diff-recall{background:rgba(0,255,136,.06);color:var(--green);border:1px solid rgba(0,255,136,.15)}
  .pq-diff-comprehension{background:rgba(29,108,240,.08);color:var(--blue2);border:1px solid rgba(29,108,240,.2)}
  .pq-diff-application{background:rgba(124,58,237,.08);color:#a78bfa;border:1px solid rgba(124,58,237,.2)}
  .pq-diff-analysis{background:rgba(255,170,0,.08);color:var(--amber);border:1px solid rgba(255,170,0,.2)}
  .pq-diff-scenario{background:rgba(255,51,85,.08);color:var(--red);border:1px solid rgba(255,51,85,.2)}
  .pq-text{font-size:.85rem;font-weight:500;color:var(--text);line-height:1.6;margin-bottom:1.125rem}
  .pq-options{display:flex;flex-direction:column;gap:.5rem}
  .pq-option{
    display:flex;gap:.875rem;align-items:flex-start;
    padding:.75rem 1rem;border-radius:8px;
    border:1px solid var(--border);cursor:pointer;
    transition:all .2s;background:rgba(4,15,32,.4);
  }
  .pq-option:hover{border-color:var(--border2);background:var(--bg4)}
  .pq-option.selected{border-color:var(--blue);background:rgba(29,108,240,.08);box-shadow:0 0 12px rgba(29,108,240,.08)}
  .pq-option.correct{border-color:var(--green);background:rgba(0,255,136,.05)}
  .pq-option.wrong{border-color:var(--red);background:rgba(255,51,85,.05)}
  .pq-option-key{font-family:var(--mono);font-size:.68rem;font-weight:600;color:var(--text3);min-width:18px;margin-top:1px}
  .pq-option-text{font-size:.78rem;color:var(--text2);line-height:1.5}
  .pq-textarea{width:100%;background:rgba(4,15,32,.6);border:1px solid var(--border2);color:var(--text);font-family:var(--mono);font-size:.78rem;border-radius:8px;padding:.875rem;resize:vertical;min-height:90px;outline:none;transition:border .2s;line-height:1.6}
  .pq-textarea:focus{border-color:var(--blue);box-shadow:0 0 0 2px rgba(29,108,240,.08)}
  .pq-textarea::placeholder{color:var(--text3)}
  .paper-result{padding:1.75rem 2.5rem;display:flex;flex-direction:column;gap:1.125rem}
  .result-banner{
    padding:1.75rem;border-radius:14px;border:1px solid rgba(29,108,240,.2);
    background:linear-gradient(135deg,rgba(29,108,240,.1),rgba(0,212,255,.04));
    display:flex;gap:2rem;align-items:center;
    position:relative;overflow:hidden;
  }
  .result-banner::before{
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,var(--blue2),var(--cyan),transparent);
  }
  .result-score-big{font-size:3.25rem;font-weight:700;font-family:var(--mono);color:var(--blue2);line-height:1;text-shadow:0 0 30px rgba(77,159,255,.3)}
  .result-label{font-size:.75rem;font-weight:600;color:var(--text);margin-bottom:.375rem}
  .result-verdict{font-size:.8rem;color:var(--text2);line-height:1.65}
  .pr-q-block{background:rgba(4,15,32,.6);border:1px solid var(--border);border-radius:10px;padding:1.25rem;margin-bottom:.875rem;transition:border .2s}
  .pr-q-block:hover{border-color:var(--border2)}
  .pr-q-text{font-size:.82rem;font-weight:500;color:var(--text);margin-bottom:.875rem;line-height:1.5}
  .pr-answer-row{display:flex;gap:.625rem;align-items:flex-start;padding:.5rem .875rem;border-radius:6px;font-size:.75rem;margin-bottom:.375rem}
  .pr-answer-row.correct-row{background:rgba(0,255,136,.04);border:1px solid rgba(0,255,136,.12)}
  .pr-answer-row.wrong-row{background:rgba(255,51,85,.04);border:1px solid rgba(255,51,85,.12)}
  .pr-answer-row.ideal-row{background:rgba(29,108,240,.04);border:1px solid rgba(29,108,240,.12)}
  .pr-explanation{font-size:.75rem;color:var(--text2);line-height:1.65;margin-top:.625rem;padding:.75rem 1rem;background:rgba(4,15,32,.6);border-radius:6px;border-left:2px solid var(--blue)}
  .gap-link{display:inline-flex;align-items:center;gap:.375rem;font-size:.68rem;font-family:var(--mono);color:var(--blue2);padding:4px 11px;border-radius:5px;border:1px solid rgba(29,108,240,.2);background:rgba(29,108,240,.05);cursor:pointer;transition:all .2s;margin:.25rem}
  .gap-link:hover{background:rgba(29,108,240,.12);border-color:rgba(29,108,240,.4);box-shadow:0 0 10px rgba(29,108,240,.1)}
  .paper-progress{display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:.625rem}
  .pp-dot{width:9px;height:9px;border-radius:50%;border:1px solid var(--border2);background:var(--bg4);transition:all .3s}
  .pp-dot.answered{background:var(--blue2);border-color:var(--blue);box-shadow:0 0 6px rgba(77,159,255,.4)}
  @keyframes soundbar{from{transform:scaleY(.4)}to{transform:scaleY(1)}}
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

  // Unwrap string JSON
  let parsed = data;
  if (typeof data === "string") {
    try { parsed = JSON.parse(data); } catch { parsed = null; }
  }

  // Sometimes wrapped in { study_plan: ... } or { result: ... }
  if (parsed?.study_plan) parsed = parsed.study_plan;
  if (parsed?.result) parsed = parsed.result;

  // Structured path: has daily_plan array
  if (parsed?.daily_plan && Array.isArray(parsed.daily_plan)) {
    return (
      <div>
        {parsed.theme && <div className="prose" style={{ marginBottom: ".75rem", color: "var(--text2)", fontStyle: "italic" }}>{parsed.theme} — {parsed.milestone}</div>}
        {parsed.daily_plan.map((day, i) => (
          <div className="plan-day" key={i}>
            <span className="plan-day-num">DAY {day.day || i + 1}</span>
            <div className="plan-day-content">
              {day.theme && <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: ".5rem" }}>{day.theme}</div>}
              {Array.isArray(day.exercises) && day.exercises.map((ex, j) => (
                <div key={j} style={{ marginBottom: ".625rem", paddingLeft: ".75rem", borderLeft: "2px solid var(--border2)" }}>
                  <div style={{ fontWeight: 500, color: "var(--text2)", fontSize: ".75rem" }}>{ex.name} {ex.duration && <span style={{ color: "var(--text3)", fontFamily: "var(--mono)", fontSize: ".65rem" }}>· {ex.duration}</span>}</div>
                  {ex.description && <div style={{ fontSize: ".72rem", color: "var(--text2)", marginTop: ".2rem", lineHeight: 1.6 }}>{ex.description}</div>}
                  {ex.goal && <div style={{ fontSize: ".65rem", color: "var(--blue2)", marginTop: ".15rem" }}>Goal: {ex.goal}</div>}
                </div>
              ))}
              {day.checkpoint && <div style={{ fontSize: ".68rem", color: "var(--amber)", fontFamily: "var(--mono)", marginTop: ".375rem" }}>Checkpoint: {day.checkpoint}</div>}
              {day.total_time && <div style={{ fontSize: ".65rem", color: "var(--text3)", marginTop: ".25rem" }}>Total: {day.total_time} min</div>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: personalized_message + daily_tips object
  if (parsed?.personalized_message || parsed?.daily_tips) {
    const tips = parsed.daily_tips || {};
    return (
      <div>
        {parsed.personalized_message && <div className="prose" style={{ marginBottom: "1rem" }}>{parsed.personalized_message}</div>}
        {Object.entries(tips).map(([day, tip], i) => (
          <div className="plan-day" key={i}>
            <span className="plan-day-num">{day.toUpperCase()}</span>
            <span className="plan-day-content">{typeof tip === "string" ? tip : JSON.stringify(tip)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Last resort: pretty print
  const raw = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return <pre className="prose" style={{ whiteSpace: "pre-wrap", fontSize: ".72rem", lineHeight: 1.6 }}>{raw.slice(0, 2000)}</pre>;
}


function AssessmentView({ data }) {
  if (!data) return <div className="prose">No assessment generated.</div>;

  // Unwrap string JSON
  let parsed = data;
  if (typeof data === "string") {
    try { parsed = JSON.parse(data); } catch { parsed = null; }
  }

  // Unwrap nested shapes
  if (parsed?.assessment) parsed = parsed.assessment;

  // Resolve questions array from various shapes
  let questions = null;
  if (Array.isArray(parsed)) {
    questions = parsed;
  } else if (parsed?.questions && Array.isArray(parsed.questions)) {
    questions = parsed.questions;
  } else if (parsed?.practice_questions && Array.isArray(parsed.practice_questions)) {
    questions = parsed.practice_questions;
  }

  // Each question might itself be a JSON string — parse them
  if (questions) {
    questions = questions.map(q => {
      if (typeof q === "string") { try { return JSON.parse(q); } catch { return { question: q }; } }
      return q;
    });
  }

  if (questions && questions.length > 0) {
    return (
      <div>
        {questions.slice(0, 8).map((q, i) => (
          <div className="q-block" key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
              <div className="q-number">Q{i + 1}</div>
              <div style={{ display: "flex", gap: ".5rem" }}>
                {q.difficulty && <span style={{ fontSize: ".6rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".06em" }}>{q.difficulty}</span>}
                {q.skill_area && <span style={{ fontSize: ".6rem", fontFamily: "var(--mono)", color: "var(--blue2)" }}>{q.skill_area}</span>}
              </div>
            </div>
            <div className="q-text">{q.question || String(q)}</div>
            {q.ideal_answer_points && Array.isArray(q.ideal_answer_points) && q.ideal_answer_points.length > 0 && (
              <div style={{ marginTop: ".625rem" }}>
                <div style={{ fontSize: ".62rem", fontFamily: "var(--mono)", color: "var(--text3)", marginBottom: ".375rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Key Points</div>
                {q.ideal_answer_points.map((pt, j) => (
                  <div key={j} style={{ fontSize: ".72rem", color: "var(--text2)", padding: ".2rem 0 .2rem .75rem", borderLeft: "2px solid var(--border2)", marginBottom: ".25rem" }}>{pt}</div>
                ))}
              </div>
            )}
            {q.options && Array.isArray(q.options) && q.options.map((opt, j) => (
              <div className="q-option" key={j}>
                <span className="pq-option-key">{String.fromCharCode(65 + j)}</span>
                <span>{opt}</span>
              </div>
            ))}
            <div className="citation-row"><span className="citation-dot" /><span>Grounded via Microsoft Foundry IQ</span></div>
          </div>
        ))}
      </div>
    );
  }

  // No questions found — show what we have
  const raw = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return <pre className="prose" style={{ whiteSpace: "pre-wrap", fontSize: ".72rem", lineHeight: 1.6 }}>{raw.slice(0, 1500)}</pre>;
}


function InsightsView({ data }) {
  if (!data) return <div className="prose">No insights generated.</div>;

  let parsed = data;
  if (typeof data === "string") {
    try { parsed = JSON.parse(data); } catch { parsed = null; }
  }
  if (parsed?.insights) parsed = parsed.insights;

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const trend = parsed.trend || parsed.trend_direction || parsed.trend?.label;
    const report = parsed.report;
    const milestones = parsed.milestones || [];
    const baseline = parsed.baseline_score ?? parsed.current_score;
    const sessions = parsed.session_count;
    const chartData = parsed.chart_data || [];
    const trendPct = parsed.trend_percentage || parsed.trend?.percentage;
    const trendDir = parsed.trend_direction || parsed.trend?.direction || "neutral";

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
              <div style={{ fontSize: ".6rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: ".375rem" }}>Score</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--mono)", color: "var(--blue2)" }}>{typeof baseline === "number" ? baseline.toFixed(1) : baseline}/10</div>
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
              <div style={{ fontSize: ".95rem", fontWeight: 700, fontFamily: "var(--mono)", color: trendDir === "up" ? "var(--green)" : trendDir === "down" ? "var(--red)" : "var(--amber)", textTransform: "capitalize" }}>
                {typeof trend === "string" ? trend : trend} {trendPct ? `${trendDir === "down" ? "-" : "+"}${Math.abs(trendPct)}%` : ""}
              </div>
            </div>
          )}
        </div>
        {milestones.length > 0 && (
          <div>
            <div style={{ fontSize: ".62rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: ".5rem" }}>Milestones</div>
            <div className="tag-row">{milestones.map((m, i) => <span key={i} className="tag green">{m}</span>)}</div>
          </div>
        )}
        {chartData.length > 0 && (
          <div>
            <div style={{ fontSize: ".62rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: ".5rem" }}>Score History</div>
            <div style={{ display: "flex", gap: ".5rem", alignItems: "flex-end", height: "60px" }}>
              {chartData.map((pt, i) => {
                const h = Math.max(8, ((pt.score || 5) / 10) * 60);
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

  const raw = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return <pre className="prose" style={{ whiteSpace: "pre-wrap", fontSize: ".72rem", lineHeight: 1.6 }}>{raw.slice(0, 1500)}</pre>;
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
            <ScoreCard label="Concept Coverage" value={comm.concept_coverage ?? comm.clarity ?? (score * 1.05 > 10 ? 9.2 : score * 1.05)} accent="var(--cyan)" />
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
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);

  // ── TTS: speak the question aloud ─────────────────────────────────────────
  function speakQuestion(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.92;
    utt.pitch = 1;
    utt.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("google"))
      || voices.find(v => v.lang === "en-US")
      || voices[0];
    if (preferred) utt.voice = preferred;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }

  // ── STT: start listening ───────────────────────────────────────────────────
  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported in this browser. Use Chrome."); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setTranscript(prev => prev + final);
      setAnswer(prev => (prev + final) || interim || prev);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function toggleListening() {
    if (listening) stopListening();
    else startListening();
  }

  // Speak question whenever it changes and we're in questioning stage
  useEffect(() => {
    if (question && stage === "questioning") {
      // small delay so UI renders first
      setTimeout(() => speakQuestion(question), 400);
    }
  }, [question, stage]);

  async function startInterview() {
    setLoading(true);
    setStreamEvents([
      { agent: "interviewer", status: "thinking", message: `Loading ${cert} interview session...` },
      { agent: "interviewer", status: "thinking", message: "Selecting opening question from cert-anchored bank..." },
    ]);
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
      setStreamEvents([{ agent: "interviewer", status: "done", message: `${cert} opening question ready` }]);
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
    setStreamEvents(e => [...e,
      { agent: "answer_analyzer", status: "thinking", message: "Extracting claims and gaps from your answer..." },
      { agent: "interviewer", status: "thinking", message: `Selecting follow-up strategy for round ${round + 1}...` },
    ]);
    try {
      const r = await fetch(`${API}/api/analysis/interview/next`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cert, round_number: round + 1, max_rounds: maxRounds, history: newHistory, memory })
      });
      const d = await r.json();
      const strategy = d.strategy ? ` [${d.strategy}]` : "";
      setQuestion(d.question || d.next_question || "Continue explaining your approach.");
      setMemory(d.memory || memory);
      setRound(prev => prev + 1);
      setStreamEvents(e => [...e, { agent: "interviewer", status: "done", message: `Round ${round + 1} ready${strategy}` }]);
    } catch {
      setStreamEvents(e => [...e, { agent: "interviewer", status: "error", message: "Request failed" }]);
    }
    setLoading(false);
  }

  async function finalAssess(h) {
    setStage("assessing");
    setLoading(true);
    setStreamEvents(e => [...e,
      { agent: "orchestrator", status: "thinking", message: "Running full multi-agent assessment pipeline..." },
      { agent: "readiness_coach", status: "thinking", message: "Evaluating interview transcript depth and accuracy..." },
      { agent: "study_plan", status: "thinking", message: "Building personalized study roadmap from identified gaps..." },
      { agent: "assessment", status: "thinking", message: "Generating grounded exam questions via Foundry IQ..." },
    ]);
    try {
      const r = await fetch(`${API}/api/analysis/interview/assess`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cert, history: h || history })
      });
      const d = await r.json();
      setResult(d.result);
      setStage("done");
      setStreamEvents(e => [...e, { agent: "orchestrator", status: "done", message: "All agents completed — full report ready" }]);
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

          {/* Question with TTS waveform */}
          <div className="interview-q" style={{ position: "relative" }}>
            {speaking && (
              <div style={{ position: "absolute", top: ".75rem", right: ".875rem", display: "flex", gap: "3px", alignItems: "flex-end", height: "16px" }}>
                {[6,12,9,14].map((h,i) => (
                  <div key={i} style={{ width: "3px", borderRadius: "2px", background: "var(--blue2)", height: `${h}px`, animation: `soundbar .6s ${i*0.1}s ease-in-out infinite alternate` }} />
                ))}
              </div>
            )}
            {question}
          </div>

          {/* Voice answer area */}
          <div style={{
            background: "rgba(4,15,32,.6)",
            border: `1.5px solid ${listening ? "var(--green)" : "var(--border2)"}`,
            borderRadius: "12px", padding: "1.25rem",
            minHeight: "110px", marginTop: ".875rem",
            transition: "border .2s, box-shadow .2s",
            boxShadow: listening ? "0 0 0 3px rgba(0,255,136,.08)" : "none",
            position: "relative",
          }}>
            {answer ? (
              <div style={{ fontSize: ".82rem", color: "var(--text)", lineHeight: 1.7 }}>{answer}</div>
            ) : (
              <div style={{ fontSize: ".78rem", color: "var(--text3)", fontStyle: "italic" }}>
                {listening ? "Listening — speak your answer..." : "Press the mic button to start speaking"}
              </div>
            )}
            {listening && (
              <div style={{ position: "absolute", bottom: ".875rem", right: ".875rem", display: "flex", gap: "3px", alignItems: "flex-end", height: "14px" }}>
                {[5,10,7,13,6].map((h,i) => (
                  <div key={i} style={{ width: "3px", borderRadius: "2px", background: "var(--green)", height: `${h}px`, animation: `soundbar .5s ${i*0.08}s ease-in-out infinite alternate` }} />
                ))}
              </div>
            )}
          </div>

          <div className="run-row" style={{ marginTop: ".875rem" }}>
            {/* Mic toggle */}
            <button onClick={toggleListening} disabled={loading || stage === "assessing" || speaking} style={{
              width: "48px", height: "48px", borderRadius: "50%", flexShrink: 0,
              border: `1.5px solid ${listening ? "var(--green)" : "var(--border2)"}`,
              background: listening ? "rgba(0,255,136,.1)" : "var(--bg3)",
              color: listening ? "var(--green)" : "var(--text2)",
              fontSize: "1.1rem", cursor: "pointer", transition: "all .2s",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: listening ? "0 0 15px rgba(0,255,136,.2)" : "none",
            }} title={listening ? "Stop" : "Record"}>
              {listening ? "■" : "🎙"}
            </button>

            {/* Replay */}
            <button onClick={() => speakQuestion(question)} disabled={speaking || loading} style={{
              padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border2)",
              background: "var(--bg3)", color: "var(--text3)", fontFamily: "var(--font)",
              fontSize: ".7rem", cursor: "pointer", transition: "all .2s",
            }}>
              {speaking ? "Speaking..." : "Replay"}
            </button>

            {/* Clear */}
            {answer && !listening && (
              <button onClick={() => setAnswer("")} style={{
                padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border)",
                background: "none", color: "var(--text3)", fontFamily: "var(--font)",
                fontSize: ".7rem", cursor: "pointer",
              }}>Clear</button>
            )}

            {/* Submit */}
            <button className="run-btn" onClick={() => { stopListening(); submitAnswer(); }}
              disabled={loading || !answer.trim() || stage === "assessing"}
              style={{ marginLeft: "auto" }}>
              {loading ? <><span className="spinner" /> Processing...</> : round >= maxRounds ? "Submit & Assess" : "Submit Answer"}
            </button>

            {stage === "assessing" && <span className="run-hint">Running multi-agent analysis...</span>}
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


// ── Utility: format seconds as MM:SS ─────────────────────────────────────────
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ── Practice Paper ────────────────────────────────────────────────────────────
function PracticePaper({ cert, onGotoStudyPlan }) {
  const [stage, setStage] = useState("config");   // config | loading | paper | result
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("mixed");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});      // { qIndex: "A"|"B"|text }
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [streamEvents, setStreamEvents] = useState([]);
  const timerRef = useRef(null);

  const TIMES = { 5: 10 * 60, 10: 20 * 60, 15: 30 * 60 };
  const DIFFICULTIES = [
    { id: "easy",   label: "Easy",   sub: "Recall & comprehension" },
    { id: "medium", label: "Medium", sub: "Application & analysis" },
    { id: "hard",   label: "Hard",   sub: "Scenario & design" },
    { id: "mixed",  label: "Mixed",  sub: "All difficulty levels" },
  ];

  function startTimer(seconds) {
    setTimeLeft(seconds);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = seconds - elapsed;
      setTimeLeft(Math.max(left, 0));
      setTimeTaken(elapsed);
      if (left <= 0) { clearInterval(timerRef.current); submitPaper(true); }
    }, 1000);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  async function generatePaper() {
    setStage("loading");
    setError("");
    setAnswers({});
    setResult(null);
    setStreamEvents([
      { agent: "assessment", status: "started", message: `Generating ${questionCount} ${difficulty} questions for ${cert}...` },
    ]);
    try {
      setStreamEvents(e => [...e, { agent: "assessment", status: "thinking", message: "Querying Foundry IQ knowledge base..." }]);
      const r = await fetch(`${API}/api/analysis/practice/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cert, question_count: questionCount, difficulty })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const qs = d.questions || [];
      if (!qs.length) throw new Error("No questions returned");
      setStreamEvents(e => [...e, { agent: "assessment", status: "completed", message: `${qs.length} questions generated — grounded in ${cert} exam domains` }]);
      setQuestions(qs);
      setStage("paper");
      startTimer(TIMES[questionCount]);
    } catch (e) {
      setStreamEvents(ev => [...ev, { agent: "assessment", status: "error", message: e.message }]);
      setError(e.message);
      setStage("config");
    }
  }

  async function submitPaper(timeUp = false) {
    clearInterval(timerRef.current);
    setStage("loading");
    setStreamEvents([
      { agent: "assessment", status: "started", message: "Scoring your answers..." },
      { agent: "assessment", status: "thinking", message: "Evaluating each response against exam criteria..." },
    ]);
    try {
      const r = await fetch(`${API}/api/analysis/practice/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cert, questions, answers, time_taken: timeTaken, time_up: timeUp })
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setStreamEvents(e => [...e, { agent: "assessment", status: "completed", message: `Scored ${d.correct}/${d.total} — ${d.score_pct}%` }]);
      setResult(d);
      setStage("result");
    } catch (e) {
      setStreamEvents(ev => [...ev, { agent: "assessment", status: "error", message: e.message }]);
      setError(e.message);
      setStage("paper");
    }
  }

  function reset() {
    clearInterval(timerRef.current);
    setStage("config");
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError("");
  }

  const timerColor = timeLeft > 300 ? "paper-timer" : timeLeft > 60 ? "paper-timer warning" : "paper-timer danger";
  const answered = Object.keys(answers).length;

  // ── Config screen ────────────────────────────────────────────────────────
  if (stage === "config") return (
    <div>
      <div className="paper-config">
        {error && <div style={{ fontSize: ".75rem", color: "var(--red)", fontFamily: "var(--mono)", padding: ".625rem .875rem", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: "6px" }}>{error}</div>}

        <div>
          <div className="config-label">Number of Questions</div>
          <div className="config-row">
            {[5, 10, 15].map(n => (
              <button key={n} className={`config-btn ${questionCount === n ? "active" : ""}`} onClick={() => setQuestionCount(n)}>
                {n} questions · {n === 5 ? "10 min" : n === 10 ? "20 min" : "30 min"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="config-label">Difficulty</div>
          <div className="config-row">
            {DIFFICULTIES.map(d => (
              <button key={d.id} className={`config-btn ${difficulty === d.id ? "active" : ""}`} onClick={() => setDifficulty(d.id)}>
                <div>{d.label}</div>
                <div style={{ fontSize: ".6rem", color: difficulty === d.id ? "var(--blue2)" : "var(--text3)", marginTop: "2px" }}>{d.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: ".875rem 1rem", background: "var(--bg3)", borderRadius: "8px", border: "1px solid var(--border)", fontSize: ".75rem", color: "var(--text2)", lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: ".25rem" }}>{cert} · {questionCount} questions · {TIMES[questionCount] / 60} minutes</div>
          Questions are generated fresh each session by the Assessment Agent using Foundry IQ context. Answers are scored with explanations and linked to your study plan gaps.
        </div>

        <button className="run-btn" onClick={generatePaper} style={{ width: "fit-content" }}>
          Generate Paper
        </button>
      </div>
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (stage === "loading") return (
    <div style={{ padding: "2rem" }}>
      <StreamPanel events={streamEvents} />
      <div className="empty-state" style={{ padding: "2rem 0" }}>
        <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
        <div style={{ fontSize: ".875rem", color: "var(--text2)", marginTop: "1rem" }}>
          {result === null && questions.length === 0 ? "Assessment Agent generating questions via Foundry IQ..." : "Scoring your answers..."}
        </div>
      </div>
    </div>
  );

  // ── Paper ─────────────────────────────────────────────────────────────────
  if (stage === "paper") return (
    <div className="paper-wrap">
      <div className="paper-header">
        <div>
          <div style={{ fontWeight: 600, fontSize: ".82rem", color: "var(--text)" }}>{cert} Practice Paper</div>
          <div className="paper-meta">{difficulty} · {questionCount} questions</div>
        </div>
        <div style={{ display: "flex", align: "center", gap: "1.5rem" }}>
          <div style={{ textAlign: "center" }}>
            <div className="paper-meta">Answered</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--blue2)", fontSize: ".95rem" }}>{answered}/{questionCount}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="paper-meta">Time Left</div>
            <div className={timerColor}>{fmtTime(timeLeft)}</div>
          </div>
        </div>
      </div>

      <div className="paper-progress">
        {questions.map((_, i) => <div key={i} className={`pp-dot ${answers[i] !== undefined ? "answered" : ""}`} />)}
      </div>

      {questions.map((q, i) => {
        const diffClass = `pq-diff-${q.difficulty || "application"}`;
        const isAnswered = answers[i] !== undefined;
        return (
          <div key={i} className={`pq-block ${isAnswered ? "answered" : ""}`}>
            <div className="pq-top">
              <div className="pq-num">Q{i + 1} of {questionCount}</div>
              <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                {q.skill_area && <span style={{ fontSize: ".62rem", fontFamily: "var(--mono)", color: "var(--text3)" }}>{q.skill_area}</span>}
                <span className={`pq-difficulty ${diffClass}`}>{q.difficulty || "application"}</span>
              </div>
            </div>
            <div className="pq-text">{q.question}</div>
            {q.options && Array.isArray(q.options) && q.options.length > 0 ? (
              <div className="pq-options">
                {q.options.map((opt, j) => {
                  const key = String.fromCharCode(65 + j);
                  const sel = answers[i] === key;
                  return (
                    <div key={j} className={`pq-option ${sel ? "selected" : ""}`} onClick={() => setAnswers(a => ({ ...a, [i]: key }))}>
                      <span className="pq-option-key">{key}</span>
                      <span className="pq-option-text">{opt}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <textarea
                className="pq-textarea"
                placeholder="Write your answer here..."
                value={answers[i] || ""}
                onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
                rows={3}
              />
            )}
          </div>
        );
      })}

      <div className="run-row" style={{ paddingBottom: "2rem" }}>
        <button className="run-btn" onClick={() => submitPaper(false)} disabled={answered === 0}>
          Submit Paper
        </button>
        <span className="run-hint">{answered} of {questionCount} answered</span>
        <button onClick={reset} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", fontFamily: "var(--font)", fontSize: ".75rem", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );

  // ── Result ────────────────────────────────────────────────────────────────
  if (stage === "result" && result) {
    const pct = result.score_pct ?? 0;
    const passed = pct >= 70;
    const scoreColor = pct >= 80 ? "var(--green)" : pct >= 65 ? "var(--amber)" : "var(--red)";
    return (
      <div className="paper-result">
        <div className="result-banner">
          <div>
            <div style={{ fontSize: ".6rem", fontFamily: "var(--mono)", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: ".375rem" }}>Final Score</div>
            <div className="result-score-big" style={{ color: scoreColor }}>{pct}%</div>
            <div style={{ fontSize: ".65rem", fontFamily: "var(--mono)", color: "var(--text3)", marginTop: ".25rem" }}>{result.correct ?? 0}/{questionCount} correct · {fmtTime(timeTaken)} taken</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="result-label" style={{ color: passed ? "var(--green)" : "var(--amber)" }}>
              {passed ? "Above Pass Threshold" : "Below Pass Threshold"}
            </div>
            <div className="result-verdict">{result.summary || (passed ? "Good performance. Review the gaps below before booking your exam." : "Focus on the weak areas below and retry when scoring above 70%.")}</div>
            {result.time_up && <div style={{ fontSize: ".68rem", color: "var(--amber)", fontFamily: "var(--mono)", marginTop: ".375rem" }}>Time expired — unanswered questions marked incorrect</div>}
          </div>
        </div>

        {result.gaps?.length > 0 && (
          <div className="block">
            <div className="block-title">Study Plan Gaps</div>
            <div style={{ fontSize: ".75rem", color: "var(--text2)", marginBottom: ".75rem" }}>These topics need more work. Go to your study plan to target them.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".375rem" }}>
              {result.gaps.map((g, i) => (
                <span key={i} className="gap-link" onClick={() => onGotoStudyPlan && onGotoStudyPlan(g)}>
                  {g} →
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="block">
          <div className="block-title">Question Review</div>
          {(result.reviewed || []).map((r, i) => (
            <div key={i} className="pr-q-block">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".625rem" }}>
                <div className="pq-num">Q{i + 1} · {r.skill_area || ""}</div>
                <span className={`pq-difficulty pq-diff-${r.difficulty || "application"}`}>{r.difficulty}</span>
              </div>
              <div className="pr-q-text">{r.question}</div>
              {r.your_answer !== undefined && (
                <div className={`pr-answer-row ${r.is_correct ? "correct-row" : "wrong-row"}`}>
                  <span style={{ fontSize: ".68rem", fontFamily: "var(--mono)", color: "var(--text3)", minWidth: 80 }}>Your answer</span>
                  <span style={{ fontSize: ".75rem", color: r.is_correct ? "var(--green)" : "var(--red)" }}>{r.your_answer || "(unanswered)"}</span>
                </div>
              )}
              {r.correct_answer && !r.is_correct && (
                <div className="pr-answer-row ideal-row">
                  <span style={{ fontSize: ".68rem", fontFamily: "var(--mono)", color: "var(--text3)", minWidth: 80 }}>Correct</span>
                  <span style={{ fontSize: ".75rem", color: "var(--blue2)" }}>{r.correct_answer}</span>
                </div>
              )}
              {r.explanation && <div className="pr-explanation">{r.explanation}</div>}
            </div>
          ))}
        </div>

        <div className="run-row">
          <button className="run-btn" onClick={reset}>New Paper</button>
          <span className="run-hint">Difficulty: {difficulty} · {cert}</span>
        </div>
      </div>
    );
  }

  return null;
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
    { icon:"v", title:"Below exam threshold", body:`${filtered.filter(l=>l.score<70).length} learner(s) are below the 70% pass threshold. ${filtered.filter(l=>l.score<60).length} are critically behind with scores under 60%.` },
    { icon:"+", title:"Exam-ready learners", body:`${filtered.filter(l=>l.score>=75).length} learner(s) have scored above 75% and are approaching exam readiness. Consider booking exam slots within 2 weeks.` },
    { icon:"t", title:"Optimal study windows", body:`Morning slots show higher completion. ${filtered.filter(l=>l.slot==="Morning").length} learner(s) prefer mornings — prioritise protecting that time from meetings.` },
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
  const [sessions, setSessions] = useState([]);
  const fileRef = useRef(null);
  const wsRef = useRef(null);
  const sessionId = useRef(Math.random().toString(36).slice(2));

  const selectedCert = CERTS.find(c => c.id === cert);

  function connectWS(onComplete) {
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
        if (ev.agent === "orchestrator" && ev.status === "completed" && ev.data?.result) {
          onComplete?.(ev.data.result);
        }
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
    setStreamEvents([
      { agent: "orchestrator", status: "started", message: "Connecting to agent pipeline...", data: {} },
      { agent: "readiness_coach", status: "thinking", message: `Evaluating ${cert} concept coverage and depth...`, data: {} },
    ]);
    try {
      let res;
      if (mode === "text") {
        try {
          res = await new Promise((resolve, reject) => {
            const ws = connectWS(resolve);
            const timeout = setTimeout(() => reject(new Error("Agent stream timed out")), 120000);
            const cleanupResolve = (value) => {
              clearTimeout(timeout);
              resolve(value);
            };
            ws.onmessage = (e) => {
              try {
                const ev = JSON.parse(e.data);
                setStreamEvents(prev => [...prev, {
                  agent:   ev.agent   || "agent",
                  status:  ev.status  || "thinking",
                  message: ev.data?.message || "",
                  data:    ev.data    || {},
                }]);
                if (ev.agent === "orchestrator" && ev.status === "completed" && ev.data?.result) {
                  cleanupResolve(ev.data.result);
                }
              } catch {}
            };
            ws.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("WebSocket connection failed"));
            };
            ws.onopen = () => ws.send(JSON.stringify({ goal: cert, transcript, session_id: sessionId.current }));
          });
        } catch (streamErr) {
          setStreamEvents(prev => [...prev, {
            agent: "system",
            status: "fallback",
            message: `${streamErr.message}; using REST analysis instead`,
            data: {},
          }]);
          const r = await fetch(`${API}/api/analysis/transcript`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ goal: cert, transcript, session_id: sessionId.current })
          });
          const d = await r.json();
          res = d.result;
        }
      } else {
        const fd = new FormData();
        fd.append("goal", cert);
        fd.append("audio_file", audioFile);
        const r = await fetch(`${API}/api/analysis/audio`, { method: "POST", body: fd });
        const d = await r.json();
        res = d.result;
      }
      setResult(res);
      // save session to progress history
      if (res) {
        setSessions(prev => [...prev, {
          id: sessionId.current,
          cert,
          score: res.overall_score ?? 0,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          date: new Date().toLocaleDateString([], { month: "short", day: "numeric" }),
          mode: mode === "text" ? "Text Analysis" : "Audio Analysis",
          strengths: res.communication_analysis?.strengths?.slice(0, 2) || [],
          gaps: res.communication_analysis?.weaknesses?.slice(0, 2) || [],
          recommendation: res.final_recommendation?.slice(0, 120) || "",
        }]);
        sessionId.current = Math.random().toString(36).slice(2); // fresh id for next session
      }
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
            {["analyze", "practice", "interview", "manager", "progress"].map(p => (
              <button key={p} className={`nav-tab ${page === p ? "active" : ""}`} onClick={() => setPage(p)}>
                {p === "practice" ? "Practice Paper" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </nav>

        <div className="main">
          <aside className="sidebar">
            <div style={{
                  fontSize: ".55rem", fontFamily: "var(--mono)", color: "var(--text3)",
                  letterSpacing: ".18em", textTransform: "uppercase", padding: ".25rem",
                  display: "flex", alignItems: "center", gap: ".5rem",
                }}>
                  <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,var(--border),transparent)" }} />
                  Certification Track
                  <div style={{ flex: 1, height: "1px", background: "linear-gradient(270deg,var(--border),transparent)" }} />
                </div>
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
              {/* Agent badges — horizontal wrapping row */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:".3rem", marginTop:".25rem" }}>
                {AGENTS.map((a, i) => (
                  <div key={a.key} style={{
                    display:"flex", alignItems:"center", gap:".3rem",
                    padding:"3px 9px", borderRadius:"12px",
                    background:"rgba(29,108,240,.07)",
                    border:"1px solid rgba(29,108,240,.18)",
                    cursor:"default", transition:"all .2s",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(29,108,240,.15)";e.currentTarget.style.borderColor="rgba(29,108,240,.4)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(29,108,240,.07)";e.currentTarget.style.borderColor="rgba(29,108,240,.18)";}}
                  >
                    <div style={{width:"4px",height:"4px",borderRadius:"50%",background:"var(--blue2)",boxShadow:"0 0 4px var(--blue2)",flexShrink:0}}/>
                    <span style={{fontSize:".58rem",fontFamily:"var(--mono)",color:"var(--blue2)",fontWeight:500,whiteSpace:"nowrap"}}>{a.label}</span>
                  </div>
                ))}
              </div>
              <div className="grounded-badge">
                Grounded via Microsoft Foundry IQ
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

                <div style={{ display:"flex", gap:".5rem", flexWrap:"wrap", padding:"1rem 2.5rem", borderBottom:"1px solid var(--border)" }}>
                  {AGENTS.map((a,i) => (
                    <div key={a.key} style={{
                      display:"flex", alignItems:"center", gap:".5rem",
                      padding:"5px 14px", borderRadius:"20px",
                      background:"rgba(29,108,240,.07)",
                      border:"1px solid rgba(29,108,240,.18)",
                      transition:"all .2s",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(29,108,240,.15)";e.currentTarget.style.borderColor="rgba(29,108,240,.4)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(29,108,240,.07)";e.currentTarget.style.borderColor="rgba(29,108,240,.18)";}}
                    >
                      <div style={{width:"5px",height:"5px",borderRadius:"50%",background:"var(--blue2)",boxShadow:"0 0 5px var(--blue2)",flexShrink:0}}/>
                      <span style={{fontSize:".68rem",fontFamily:"var(--mono)",color:"var(--blue2)",fontWeight:500,whiteSpace:"nowrap"}}>{a.label}</span>
                      <span style={{fontSize:".6rem",color:"var(--text3)",whiteSpace:"nowrap"}}>{a.desc}</span>
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

            {page === "practice" && (
              <>
                <div className="hero">
                  <div className="hero-eyebrow">Practice Paper · {cert}</div>
                  <div className="hero-title">Timed <em>mock exam</em></div>
                  <div className="hero-sub">AI-generated questions via Foundry IQ. New questions every session. Scored with explanations and gap analysis.</div>
                </div>
                <PracticePaper cert={cert} onGotoStudyPlan={() => setPage("analyze")} />
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
                  <div className="hero-sub">Every analysis and interview session is tracked here. Scores update in real time as you complete sessions.</div>
                </div>
                <div className="input-zone">

                  {/* Summary cards */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:".75rem", marginBottom:"1.25rem" }}>
                    {CERTS.map(c => {
                      const certSessions = sessions.filter(s => s.cert === c.id);
                      const latest = certSessions[certSessions.length - 1];
                      const best = certSessions.length ? Math.max(...certSessions.map(s => s.score)) : null;
                      const avg = certSessions.length ? (certSessions.reduce((a,s) => a + s.score, 0) / certSessions.length).toFixed(1) : null;
                      return (
                        <div key={c.id} className="block" style={{ borderColor: certSessions.length ? c.color + "44" : "var(--border)", marginBottom:0 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:".625rem" }}>
                            <span style={{ fontSize:".7rem", fontWeight:700, color: certSessions.length ? c.color : "var(--text3)", fontFamily:"var(--mono)" }}>{c.id}</span>
                            <span style={{ fontSize:".6rem", color:"var(--text3)", fontFamily:"var(--mono)" }}>{certSessions.length} session{certSessions.length !== 1 ? "s" : ""}</span>
                          </div>
                          {certSessions.length === 0 ? (
                            <div style={{ fontSize:".7rem", color:"var(--text3)" }}>No sessions yet</div>
                          ) : (
                            <>
                              <div style={{ fontSize:"1.75rem", fontWeight:700, fontFamily:"var(--mono)", color: latest.score >= 7.5 ? "var(--green)" : latest.score >= 6 ? "var(--amber)" : "var(--red)" }}>
                                {latest.score.toFixed(1)}
                                <span style={{ fontSize:".65rem", color:"var(--text3)", marginLeft:".25rem" }}>/10 latest</span>
                              </div>
                              <div style={{ display:"flex", gap:"1rem", marginTop:".375rem" }}>
                                <span style={{ fontSize:".65rem", color:"var(--text3)", fontFamily:"var(--mono)" }}>best <span style={{ color:"var(--blue2)" }}>{best.toFixed(1)}</span></span>
                                <span style={{ fontSize:".65rem", color:"var(--text3)", fontFamily:"var(--mono)" }}>avg <span style={{ color:"var(--text2)" }}>{avg}</span></span>
                              </div>
                              <div className="progress-bar-wrap" style={{ marginTop:".5rem" }}>
                                <div className="progress-bar-fill" style={{ width:`${(latest.score/10)*100}%`, background: c.color }} />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Session history */}
                  <div className="block">
                    <div className="block-title" style={{ marginBottom:".875rem" }}>Session History</div>
                    {sessions.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"2rem 0", color:"var(--text3)", fontSize:".8rem" }}>
                        No sessions yet — run an analysis or complete an interview to start tracking.
                      </div>
                    ) : (
                      [...sessions].reverse().map((s, i) => {
                        const certColor = CERTS.find(c => c.id === s.cert)?.color || "var(--blue)";
                        const scoreColor = s.score >= 7.5 ? "var(--green)" : s.score >= 6 ? "var(--amber)" : "var(--red)";
                        return (
                          <div key={s.id} style={{
                            background:"var(--bg3)", border:"1px solid var(--border)",
                            borderRadius:"8px", padding:".875rem 1rem", marginBottom:".625rem",
                            display:"flex", gap:"1rem", alignItems:"flex-start",
                            borderLeft:`3px solid ${certColor}`,
                          }}>
                            <div style={{ minWidth:"48px", textAlign:"center" }}>
                              <div style={{ fontSize:"1.4rem", fontWeight:700, fontFamily:"var(--mono)", color: scoreColor, lineHeight:1 }}>{s.score.toFixed(1)}</div>
                              <div style={{ fontSize:".55rem", color:"var(--text3)", fontFamily:"var(--mono)" }}>/10</div>
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".375rem", flexWrap:"wrap" }}>
                                <span style={{ fontSize:".7rem", fontWeight:700, color: certColor, fontFamily:"var(--mono)" }}>{s.cert}</span>
                                <span style={{ fontSize:".6rem", color:"var(--text3)", fontFamily:"var(--mono)" }}>{s.mode}</span>
                                <span style={{ fontSize:".6rem", color:"var(--text3)", marginLeft:"auto", fontFamily:"var(--mono)" }}>{s.date} · {s.timestamp}</span>
                              </div>
                              {s.recommendation && (
                                <div style={{ fontSize:".72rem", color:"var(--text2)", lineHeight:1.5, marginBottom:".375rem" }}>{s.recommendation}{s.recommendation.length === 120 ? "…" : ""}</div>
                              )}
                              <div style={{ display:"flex", gap:".375rem", flexWrap:"wrap" }}>
                                {s.strengths.map((t,j) => <span key={j} className="tag green" style={{ fontSize:".58rem" }}>{t}</span>)}
                                {s.gaps.map((t,j) => <span key={j} className="tag red" style={{ fontSize:".58rem" }}>{t}</span>)}
                              </div>
                            </div>
                            <div style={{ fontSize:".6rem", fontFamily:"var(--mono)", padding:"3px 8px", borderRadius:"4px",
                              background: s.score >= 7.5 ? "rgba(0,255,136,.1)" : s.score >= 6 ? "rgba(255,170,0,.1)" : "rgba(255,51,85,.1)",
                              color: scoreColor, border:`1px solid ${scoreColor}44`, whiteSpace:"nowrap" }}>
                              {s.score >= 7.5 ? "Exam Ready" : s.score >= 6 ? "Developing" : "Needs Work"}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {sessions.length > 0 && (
                    <div style={{ textAlign:"right" }}>
                      <button onClick={() => setSessions([])} style={{
                        background:"none", border:"1px solid var(--border)", color:"var(--text3)",
                        fontFamily:"var(--mono)", fontSize:".65rem", padding:"4px 10px",
                        borderRadius:"5px", cursor:"pointer"
                      }}>Clear history</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
