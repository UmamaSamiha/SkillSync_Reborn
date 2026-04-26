import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const MODES = [
  { label:"Work",        duration:25*60, color:"#CB7885" },
  { label:"Short Break", duration:5*60,  color:"#D4D994" },
  { label:"Long Break",  duration:15*60, color:"#7A9E6B" },
];

const MAX_SESSIONS = 4;

function pad(n) { return String(n).padStart(2,"0"); }

export default function FocusPage() {
  const [modeIdx,      setModeIdx]      = useState(0);
  const [timeLeft,     setTimeLeft]     = useState(MODES[0].duration);
  const [running,      setRunning]      = useState(false);
  const [sessionsDone, setSessionsDone] = useState(0);
  const [notify,       setNotify]       = useState(true);
  const intervalRef = useRef(null);
  const navigate    = useNavigate();

  const mode  = MODES[modeIdx];
  const total = mode.duration;
  const R     = 110;
  const CIRC  = 2 * Math.PI * R;
  const dash  = CIRC * (timeLeft / total);
  const mins  = Math.floor(timeLeft / 60);
  const secs  = timeLeft % 60;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (modeIdx === 0) {
              const nd = sessionsDone + 1;
              setSessionsDone(nd);
              const next = nd % MAX_SESSIONS === 0 ? 2 : 1;
              setModeIdx(next);
              setTimeLeft(MODES[next].duration);
            } else {
              setModeIdx(0);
              setTimeLeft(MODES[0].duration);
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, modeIdx, sessionsDone]);

  const handleSkip = () => {
    setRunning(false);
    const next = (modeIdx + 1) % MODES.length;
    setModeIdx(next);
    setTimeLeft(MODES[next].duration);
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:"#1A1008",
      display:"flex",
      flexDirection:"column",
      alignItems:"center",
      padding:"24px 20px 40px",
      marginLeft:"calc(-1 * 220px)",
      marginRight:"-32px",
      marginTop:"-32px",
    }}>
      <div style={{ width:"100%", maxWidth:700, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:48 }}>
        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.2rem", fontWeight:700, color:"rgba(255,255,255,0.9)" }}>
          SkillSync
        </span>
        <div style={{ width:34, height:34, borderRadius:"50%", background:"#893941", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.85rem", fontWeight:600 }}>
          TA
        </div>
      </div>

      <p style={{ fontSize:"0.88rem", color:"rgba(255,255,255,0.45)", marginBottom:24 }}>
        Currently studying: <strong style={{ color:"rgba(255,255,255,0.7)", fontWeight:500 }}>Database Systems</strong>
      </p>

      <div style={{ position:"relative", width:260, height:260, marginBottom:28 }}>
        <svg viewBox="0 0 260 260" width="260" height="260">
          <circle cx="130" cy="130" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
          <circle
            cx="130" cy="130" r={R}
            fill="none"
            stroke={mode.color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC}`}
            transform="rotate(-90 130 130)"
            style={{ transition:"stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"3.2rem", fontWeight:600, color:"rgba(255,255,255,0.92)", letterSpacing:"-0.02em", lineHeight:1 }}>
            {pad(mins)}:{pad(secs)}
          </span>
          <span style={{ fontSize:"0.8rem", color:"rgba(255,255,255,0.35)", marginTop:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>
            {mode.label}
          </span>
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:32 }}>
        {Array.from({ length: MAX_SESSIONS }).map((_,i) => (
          <div key={i} style={{
            width:10, height:10, borderRadius:"50%",
            background: i < sessionsDone ? "#CB7885" : i === sessionsDone ? "#893941" : "rgba(255,255,255,0.15)",
            boxShadow: i === sessionsDone ? "0 0 8px #893941" : "none",
          }} />
        ))}
        <span style={{ fontSize:"0.78rem", color:"rgba(255,255,255,0.3)", marginLeft:4 }}>
          Session {Math.min(sessionsDone+1, MAX_SESSIONS)} of {MAX_SESSIONS}
        </span>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:36 }}>
        <button
          onClick={() => setRunning(false)}
          disabled={!running}
          style={{
            padding:"10px 28px", borderRadius:999,
            background:"transparent", border:"1.5px solid rgba(255,255,255,0.25)",
            color:"rgba(255,255,255,0.7)", cursor:"pointer", fontSize:"0.9rem",
            opacity: !running ? 0.35 : 1,
          }}>
          Pause
        </button>
        <button
          onClick={() => setRunning(r => !r)}
          style={{
            padding:"10px 28px", borderRadius:999, minWidth:110,
            background:"#893941", border:"none", color:"#fff",
            cursor:"pointer", fontSize:"0.9rem", fontWeight:500,
            boxShadow:"0 4px 16px rgba(137,57,65,0.4)",
          }}>
          {running ? "Pause" : "Resume"}
        </button>
        <button
          onClick={handleSkip}
          style={{
            padding:"10px 28px", borderRadius:999,
            background:"transparent", border:"none",
            color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:"0.9rem",
          }}>
          Skip
        </button>
      </div>

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
        <label style={{ display:"flex", alignItems:"center", gap:10, fontSize:"0.82rem", color:"rgba(255,255,255,0.4)", cursor:"pointer" }}>
          <span>Alert: New Tab</span>
          <div
            onClick={() => setNotify(n => !n)}
            style={{
              width:40, height:22, borderRadius:999, position:"relative", cursor:"pointer",
              background: notify ? "#893941" : "rgba(255,255,255,0.15)",
              transition:"background 0.15s",
            }}>
            <div style={{
              width:16, height:16, borderRadius:"50%", background:"#fff",
              position:"absolute", top:3,
              left: notify ? 21 : 3,
              transition:"left 0.15s",
              boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
            }} />
          </div>
          <span>{notify ? "ON" : "Off"}</span>
        </label>

        <button
          onClick={() => navigate("/history")}
          style={{
            background:"none", border:"none",
            color:"rgba(255,255,255,0.25)", fontSize:"0.8rem",
            cursor:"pointer", textDecoration:"underline",
          }}>
          Exit Focus Mode
        </button>
      </div>
    </div>
  );
}