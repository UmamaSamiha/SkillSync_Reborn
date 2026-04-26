import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './TimeTracker.css';

function fmt(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '00')}`;
}

function WeeklyChart({ days }) {
  const max = Math.max(...days.map(d => d.total), 1);
  return (
    <div className="weekly-chart">
      {days.map((d, i) => {
        const studyH  = (d.study      / max) * 100;
        const assignH = (d.assignment / max) * 100;
        const isToday = new Date().getDay() === (i + 1) % 7;
        return (
          <div key={i} className={`chart-col ${isToday ? 'today' : ''}`}>
            <div className="chart-bar-wrap">
              {d.assignment > 0 && (
                <div className="bar-segment bar-assignment"
                  style={{ height: `${assignH}%` }}
                  title={`Assignment: ${d.assignment}min`} />
              )}
              {d.study > 0 && (
                <div className="bar-segment bar-study"
                  style={{ height: `${studyH}%` }}
                  title={`Study: ${d.study}min`} />
              )}
            </div>
            <span className="chart-label">{d.label}</span>
            {d.total > 0 && (
              <span className="chart-value">{Math.round(d.total / 60 * 10) / 10}h</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TimeTrackerPage() {
  const [courses,     setCourses]     = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [weekly,      setWeekly]      = useState(null);
  const [recentLogs,  setRecentLogs]  = useState([]);

  const [running,    setRunning]    = useState(false);
  const [elapsed,    setElapsed]    = useState(0);
  const [courseId,   setCourseId]   = useState('');
  const [assignId,   setAssignId]   = useState('');
  const [logType,    setLogType]    = useState('study');
  const [description, setDescription] = useState('');

  const intervalRef = useRef(null);
  const startRef    = useRef(null);

  const fetchAll = useCallback(() => {
    api.get('/courses/').then(r => setCourses(r.data?.data ?? [])).catch(() => {});
    api.get('/assignments/?per_page=50').then(r => setAssignments(r.data?.data?.items ?? [])).catch(() => {});
    api.get('/timelogs/weekly').then(r => setWeekly(r.data?.data)).catch(() => {});
    api.get('/timelogs/').then(r => setRecentLogs(r.data?.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const startTimer = () => {
    setRunning(true);
    setElapsed(0);
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = async () => {
    clearInterval(intervalRef.current);
    setRunning(false);

    const minutes = Math.max(1, Math.round(elapsed / 60));
    try {
      await api.post('/timelogs/', {
        course_id:     logType === 'study'      ? (courseId || null) : null,
        assignment_id: logType === 'assignment' ? (assignId || null) : null,
        description:   description || (logType === 'study' ? 'Study session' : 'Assignment work'),
        minutes,
        log_type: logType,
      });
      toast.success(`Logged ${minutes} min!`);
      fetchAll();
    } catch {
      toast.error('Failed to save time log');
    }
    setElapsed(0);
  };

  const totalHrs = weekly ? Math.round(weekly.total_minutes / 60 * 10) / 10 : 0;
  const lastHrs  = weekly ? Math.round(weekly.last_week_minutes / 60 * 10) / 10 : 0;
  const diff     = totalHrs - lastHrs;
  const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const trendColor = diff > 0 ? 'var(--color-success)' : diff < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)';

  return (
    <div className="timetracker-page">
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>Time Tracker</h1>
      <p className="text-muted text-sm mb-24">Track study and assignment time to measure your weekly productivity.</p>

      <div className="tracker-grid">
        {/* ── Timer Panel ─────────────────────────── */}
        <div className="card timer-panel">
          <h3 className="mb-16" style={{ fontFamily: 'var(--font-display)' }}>Start Session</h3>

          <div className="timer-display">{fmt(elapsed)}</div>

          <div className="timer-controls mb-16">
            <div className="login-field">
              <label>Type</label>
              <select className="input" value={logType} onChange={e => { setLogType(e.target.value); setCourseId(''); setAssignId(''); }} disabled={running}>
                <option value="study">Course Study</option>
                <option value="assignment">Assignment Writing</option>
              </select>
            </div>

            {logType === 'study' && (
              <div className="login-field">
                <label>Course</label>
                <select className="input" value={courseId} onChange={e => setCourseId(e.target.value)} disabled={running}>
                  <option value="">— Select course —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                </select>
              </div>
            )}

            {logType === 'assignment' && (
              <div className="login-field">
                <label>Assignment</label>
                <select className="input" value={assignId} onChange={e => setAssignId(e.target.value)} disabled={running}>
                  <option value="">— Select assignment —</option>
                  {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
            )}

            <div className="login-field">
              <label>Note (optional)</label>
              <input className="input" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What are you working on?" disabled={running} />
            </div>
          </div>

          {!running
            ? <button className="btn btn-primary w-full" onClick={startTimer}><Play size={15} /> Start</button>
            : <button className="btn btn-danger w-full" onClick={stopTimer}><Square size={15} /> Stop & Save</button>
          }
        </div>

        {/* ── Weekly Stats ─────────────────────────── */}
        <div className="card stats-panel">
          <div className="flex-between mb-16">
            <h3 style={{ fontFamily: 'var(--font-display)' }}>This Week</h3>
            <div className="flex-center gap-8" style={{ color: trendColor, fontSize: '0.85rem', fontWeight: 600 }}>
              <TrendIcon size={16} />
              {diff > 0 ? '+' : ''}{diff.toFixed(1)}h vs last week
            </div>
          </div>

          <div className="grid-2 mb-16" style={{ gap: 12 }}>
            <div className="stat-card">
              <div className="stat-icon"><Clock size={18} /></div>
              <div><div className="stat-value">{totalHrs}h</div><div className="stat-label">This week</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}>
                <Clock size={18} />
              </div>
              <div><div className="stat-value">{lastHrs}h</div><div className="stat-label">Last week</div></div>
            </div>
          </div>

          {weekly?.days && <WeeklyChart days={weekly.days} />}

          <div className="chart-legend">
            <span className="legend-dot" style={{ background: 'var(--color-primary)' }} /> Study
            <span className="legend-dot" style={{ background: 'var(--color-accent)', marginLeft: 16 }} /> Assignment
          </div>
        </div>
      </div>

      {/* ── Recent Logs ───────────────────────────── */}
      {recentLogs.length > 0 && (
        <div className="card mt-24">
          <h3 className="mb-16" style={{ fontFamily: 'var(--font-display)' }}>Recent Sessions</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Context</th><th>Note</th><th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map(l => (
                <tr key={l.id}>
                  <td className="text-muted">{new Date(l.logged_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</td>
                  <td>
                    <span className={`badge ${l.log_type === 'assignment' ? 'badge-success' : 'badge-info'}`}>
                      {l.log_type}
                    </span>
                  </td>
                  <td>{l.course_title || '—'}</td>
                  <td className="text-muted">{l.description || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{l.minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
