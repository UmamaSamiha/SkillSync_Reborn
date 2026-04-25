import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const MODES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const LABELS = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };

export default function FocusPage() {
  const [mode,    setMode]    = useState('focus');
  const [seconds, setSeconds] = useState(MODES.focus);
  const [running, setRunning] = useState(false);
  const [topic,   setTopic]   = useState('');
  const [sessions, setSessions] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    setSeconds(MODES[mode]);
    setRunning(false);
    clearInterval(intervalRef.current);
  }, [mode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            const dur = MODES[mode] / 60;
            setSessions(prev => [{ id: Date.now(), topic: topic || mode, duration: dur, time: new Date().toLocaleTimeString() }, ...prev]);
            toast.success(`${LABELS[mode]} session complete! 🎉`);
            return MODES[mode];
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode, topic]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const progress = ((MODES[mode] - seconds) / MODES[mode]) * 100;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Focus Timer</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 32 }}>Stay in the zone. Track your sessions.</p>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {Object.keys(MODES).map(m => (
          <button key={m} onClick={() => setMode(m)} className="btn"
            style={{ background: mode === m ? 'var(--color-primary)' : 'var(--color-surface)', color: mode === m ? '#fff' : 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
            {LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: 48, textAlign: 'center', maxWidth: 380, marginBottom: 24 }}>
        <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto 24px' }}>
          <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="90" cy="90" r="80" fill="none" stroke="var(--color-border)" strokeWidth="8" />
            <circle cx="90" cy="90" r="80" fill="none" stroke="var(--color-primary)" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 80}`}
              strokeDashoffset={`${2 * Math.PI * 80 * (1 - progress / 100)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset .5s' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 42, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</span>
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{LABELS[mode]}</span>
          </div>
        </div>

        <input className="input" placeholder="What are you focusing on?" value={topic}
          onChange={e => setTopic(e.target.value)} style={{ marginBottom: 16, textAlign: 'center' }} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ minWidth: 100 }} onClick={() => setRunning(r => !r)}>
            {running ? '⏸ Pause' : '▶ Start'}
          </button>
          <button className="btn" style={{ background: 'var(--color-border)', color: 'var(--color-muted)' }}
            onClick={() => { setRunning(false); setSeconds(MODES[mode]); }}>
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Session log */}
      {sessions.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, maxWidth: 380 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Today's Sessions</h3>
          {sessions.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
              <span>{s.topic}</span>
              <span style={{ color: 'var(--color-muted)' }}>{s.duration} min · {s.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
