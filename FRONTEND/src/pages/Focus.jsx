import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

const MODES = [
  { label: "Work",        duration: 25 * 60 , color: "#CB7885" },
  { label: "Short Break", duration: 5  * 60, color: "#D4D994" },
  { label: "Long Break",  duration: 15 * 60, color: "#7A9E6B" },
];

const MAX_SESSIONS = 4;

function pad(n) { return String(n).padStart(2, "0"); }

// ── Timer states ──────────────────────────────────────────────────────────────
// IDLE    → shows subject input + single "Start" button
// RUNNING → shows "Stop" (left) + "Pause" (center)
// PAUSED  → shows "Stop" (left) + "Resume" (center)
// BREAK   → shows single "Skip Break" button

export default function FocusPage() {
  const [timerState,    setTimerState]    = useState("IDLE");
  const [modeIdx,       setModeIdx]       = useState(0);
  const [timeLeft,      setTimeLeft]      = useState(MODES[0].duration);
  const [sessionsDone,  setSessionsDone]  = useState(0);
  const [notify,        setNotify]        = useState(true);
  const [topic,         setTopic]         = useState("");
  const [topicInput,    setTopicInput]    = useState("");
  const [sessionId,     setSessionId]     = useState(null);   // active backend session id
  const [startedAt,     setStartedAt]     = useState(null);

  const intervalRef = useRef(null);
  const navigate    = useNavigate();

  const mode  = MODES[modeIdx];
  const total = mode.duration;
  const R     = 110;
  const CIRC  = 2 * Math.PI * R;
  const dash  = CIRC * (timeLeft / total);
  const mins  = Math.floor(timeLeft / 60);
  const secs  = timeLeft % 60;

  const isWork    = modeIdx === 0;
  const isRunning = timerState === "RUNNING" || timerState === "BREAK";

  // ── Tick ──────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(intervalRef.current);

    if (timerState === "RUNNING" || timerState === "BREAK") {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(intervalRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    
    return () => clearInterval(intervalRef.current);
  }, [timerState]); 

  // ── Handle countdown reaching 0 ───────────────────────────────
  useEffect(() => {
    if (timeLeft !== 0) return;
    clearInterval(intervalRef.current);

    if (isWork) {
      if (sessionId) {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        // Force at least 1 minute so the backend doesn't reject a 0-minute session
        const minsLogged = Math.max(1, Math.round(elapsed / 60)); 

        api.put(`/focus/${sessionId}/complete`, {
          sessions_count: sessionsDone + 1,
          notes: `Completed ${topic} — ${minsLogged} min`,
        }).then(() => {
          console.log("✅ Session successfully saved to backend!");
        }).catch(err => console.error("❌ Failed to save session:", err));
        
        setSessionId(null);
      }

      const nd   = sessionsDone + 1;
      setSessionsDone(nd);
      const next = nd % MAX_SESSIONS === 0 ? 2 : 1;
      setModeIdx(next);
      setTimeLeft(MODES[next].duration);
      setTimerState("BREAK"); 
    } else {
      setModeIdx(0);
      setTimeLeft(MODES[0].duration);
      setTimerState("IDLE");
    }
  }, [timeLeft, isWork, sessionId, startedAt, topic, sessionsDone]); 
  
  // ── Actions ───────────────────────────────────────────────────
  const handleStart = async () => {
    const t = topicInput.trim();
    if (!t) return;
    setTopic(t);
    setStartedAt(Date.now());

    // Start session on backend
    try {
      const res = await api.post("/focus/start", { topic_label: t, duration_minutes: 25 });
      setSessionId(res.data?.data?.id || null);
    } catch (e) {
      console.error("Could not start focus session:", e);
      // Allow timer to run even if API fails
    }

    setTimerState("RUNNING");
  };

  const handlePause = () => setTimerState("PAUSED");

  const handleResume = () => setTimerState("RUNNING");

  const handleStop = async () => {
    // Interrupt the backend session if at least 60 s have elapsed
    if (sessionId && startedAt) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      if (elapsed >= 1) {
        api.put(`/focus/${sessionId}/interrupt`).catch(console.error);
      }
    }
    setSessionId(null);
    setTimerState("IDLE");
    setModeIdx(0);
    setTimeLeft(MODES[0].duration);
    setTopicInput(topic);
  };

  const handleSkipBreak = () => {
    clearInterval(intervalRef.current);
    setModeIdx(0);
    setTimeLeft(MODES[0].duration);
    setTimerState("IDLE");
  };

  return (
    <div style={{
      minHeight:     "100vh",
      background:    "#1A1008",
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      padding:       "24px 20px 40px",
      marginLeft:    "calc(-1 * 220px)",
      marginRight:   "-32px",
      marginTop:     "-32px",
    }}>
      {/* Header */}
      <div style={{ width: "100%", maxWidth: 700, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.2rem", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
          SkillSync
        </span>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#893941", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 600 }}>
          TA
        </div>
      </div>

      {/* Subject input / label */}
      {timerState === "IDLE" && modeIdx === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <label style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
            What are you studying?
          </label>
          <input
            type="text"
            value={topicInput}
            onChange={e => setTopicInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleStart()}
            placeholder="e.g. Database Systems"
            autoFocus
            style={{
              padding:    "10px 18px",
              borderRadius: 999,
              border:     "1.5px solid rgba(203,120,133,0.4)",
              background: "rgba(255,255,255,0.05)",
              color:      "rgba(255,255,255,0.85)",
              fontSize:   "0.9rem",
              fontFamily: "inherit",
              textAlign:  "center",
              outline:    "none",
              width:      280,
            }}
          />
        </div>
      ) : (
        <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.45)", marginBottom: 28 }}>
          Currently studying:{" "}
          <strong style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
            {modeIdx === 0 ? topic : "On a break ☕"}
          </strong>
        </p>
      )}

      {/* Circular timer */}
      <div style={{ position: "relative", width: 260, height: 260, marginBottom: 28 }}>
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
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "3.2rem", fontWeight: 600, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.02em", lineHeight: 1 }}>
            {pad(mins)}:{pad(secs)}
          </span>
          <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {mode.label}
          </span>
        </div>
      </div>

      {/* Session dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
        {Array.from({ length: MAX_SESSIONS }).map((_, i) => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: "50%",
            background: i < sessionsDone ? "#CB7885" : i === sessionsDone ? "#893941" : "rgba(255,255,255,0.15)",
            boxShadow:  i === sessionsDone ? "0 0 8px #893941" : "none",
          }} />
        ))}
        <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.3)", marginLeft: 4 }}>
          Session {Math.min(sessionsDone + 1, MAX_SESSIONS)} of {MAX_SESSIONS}
        </span>
      </div>

      {/* Dynamic buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>

        {timerState === "IDLE" && (
          <button
            onClick={handleStart}
            disabled={!topicInput.trim()}
            style={{
              padding:      "12px 52px",
              borderRadius: 999,
              background:   topicInput.trim() ? "#893941" : "rgba(137,57,65,0.35)",
              border:       "none",
              color:        "#fff",
              cursor:       topicInput.trim() ? "pointer" : "not-allowed",
              fontSize:     "0.95rem",
              fontWeight:   600,
              boxShadow:    topicInput.trim() ? "0 4px 16px rgba(137,57,65,0.4)" : "none",
              transition:   "all 0.2s",
            }}>
            Start
          </button>
        )}

        {timerState === "RUNNING" && (<>
          <button onClick={handleStop} style={{ padding: "10px 28px", borderRadius: 999, background: "transparent", border: "1.5px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "0.9rem" }}>
            Stop
          </button>
          <button onClick={handlePause} style={{ padding: "10px 28px", borderRadius: 999, minWidth: 110, background: "#893941", border: "none", color: "#fff", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500, boxShadow: "0 4px 16px rgba(137,57,65,0.4)" }}>
            Pause
          </button>
        </>)}

        {timerState === "PAUSED" && (<>
          <button onClick={handleStop} style={{ padding: "10px 28px", borderRadius: 999, background: "transparent", border: "1.5px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "0.9rem" }}>
            Stop
          </button>
          <button onClick={handleResume} style={{ padding: "10px 28px", borderRadius: 999, minWidth: 110, background: "#893941", border: "none", color: "#fff", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500, boxShadow: "0 4px 16px rgba(137,57,65,0.4)" }}>
            Resume
          </button>
        </>)}

        {timerState === "BREAK" && (<>
          <button onClick={handleSkipBreak} style={{ padding: "10px 28px", borderRadius: 999, background: "transparent", border: "1.5px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "0.9rem" }}>
            Skip Break
          </button>
          <button onClick={handlePause} style={{ padding: "10px 28px", borderRadius: 999, minWidth: 110, background: "#D4D994", border: "none", color: "#1A1008", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, boxShadow: "0 4px 16px rgba(212,217,148,0.4)" }}>
            Pause Break
          </button>
        </>)}
      </div>

      {/* Alert toggle + Exit */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.82rem", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
          <span>Alert: New Tab</span>
          <div
            onClick={() => setNotify(n => !n)}
            style={{ width: 40, height: 22, borderRadius: 999, position: "relative", cursor: "pointer", background: notify ? "#893941" : "rgba(255,255,255,0.15)", transition: "background 0.15s" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: notify ? 21 : 3, transition: "left 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
          </div>
          <span>{notify ? "ON" : "Off"}</span>
        </label>

        <button
          onClick={async () => { await handleStop(); navigate("/history"); }}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}>
          Exit Focus Mode
        </button>
      </div>
    </div>
  );
}