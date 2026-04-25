import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

function computeDiff(oldText, newText) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  const result   = [];
  const maxLen   = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === undefined)      result.push({ type: 'added',   text: n });
    else if (n === undefined) result.push({ type: 'removed', text: o });
    else if (o !== n) {
      result.push({ type: 'removed', text: o });
      result.push({ type: 'added',   text: n });
    } else {
      result.push({ type: 'same', text: o });
    }
  }
  return result;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function AIBadge({ score, flagged }) {
  if (score === null || score === undefined) {
    return (
      <span style={{
        fontSize: 11, padding: '2px 8px', borderRadius: 20,
        background: 'rgba(139,146,165,.15)', color: 'var(--color-muted)',
      }}>Not analyzed</span>
    );
  }
  const pct   = Math.round(score * 100);
  const color = flagged ? 'var(--color-red)'    : 'var(--color-green)';
  const bg    = flagged ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)';
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20,
      background: bg, color, fontWeight: 700,
    }}>
      {flagged ? '⚠️ AI' : '✅ Human'} {pct}%
    </span>
  );
}

function Timeline({ events, onCompare }) {
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 2
          ? [...prev, id]
          : [prev[1], id]
    );
  };

  return (
    <div>
      {selected.length === 2 ? (
        <button className="btn btn-primary"
          style={{ marginBottom: 12, fontSize: 13 }}
          onClick={() => onCompare(
            events.find(e => e.id === selected[0]),
            events.find(e => e.id === selected[1]),
          )}>
          Compare Selected Versions
        </button>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12 }}>
          Select 2 versions to compare
        </p>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        maxHeight: 300, overflowY: 'auto',
      }}>
        {events.map((ev, i) => (
          <div key={ev.id} onClick={() => toggle(ev.id)} style={{
            padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${selected.includes(ev.id) ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: selected.includes(ev.id) ? 'rgba(99,102,241,.08)' : 'var(--color-bg)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: ev.is_paste ? 'rgba(239,68,68,.2)' : 'rgba(99,102,241,.15)',
              color: ev.is_paste ? 'var(--color-red)' : 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  {formatDate(ev.created_at)}
                </span>
                {ev.is_paste && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px',
                    borderRadius: 20, background: 'rgba(239,68,68,.15)',
                    color: 'var(--color-red)',
                  }}>⚠️ PASTE</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                +{ev.chars_added} / -{ev.chars_removed} chars · {ev.text_snapshot.length} total
              </div>
            </div>
            {selected.includes(ev.id) && (
              <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 700 }}>
                #{selected.indexOf(ev.id) + 1}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffViewer({ evA, evB, onClose }) {
  const diff = computeDiff(evA.text_snapshot, evB.text_snapshot);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 28, maxWidth: 800, width: '90%', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700 }}>Version Comparison</h3>
          <button className="btn" onClick={onClose} style={{
            background: 'var(--color-border)', color: 'var(--color-muted)', padding: '6px 14px',
          }}>✕ Close</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--color-muted)' }}>Version {formatDate(evA.created_at)}</span>
          <span style={{ color: 'var(--color-muted)' }}>→</span>
          <span style={{ color: 'var(--color-muted)' }}>Version {formatDate(evB.created_at)}</span>
        </div>
        <div style={{ overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, flex: 1 }}>
          {diff.map((line, i) => (
            <div key={i} style={{
              padding: '2px 8px', borderRadius: 4,
              background:
                line.type === 'added'   ? 'rgba(34,197,94,.12)'  :
                line.type === 'removed' ? 'rgba(239,68,68,.12)'  : 'transparent',
              color:
                line.type === 'added'   ? 'var(--color-green)'   :
                line.type === 'removed' ? 'var(--color-red)'     : 'var(--color-text)',
            }}>
              {line.type === 'added' ? '+ ' : line.type === 'removed' ? '− ' : '  '}
              {line.text || ' '}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Teacher scoring panel ─────────────────────────────────────────────────────
function ScorePanel({ submission, onScored }) {
  const [score,   setScore]   = useState('');
  const [scoring, setScoring] = useState(false);

  const handleScore = async () => {
    const n = parseInt(score, 10);
    if (isNaN(n) || n < 0 || n > 100) {
      toast.error('Enter a score between 0 and 100');
      return;
    }
    setScoring(true);
    try {
      const res = await api.post(`/edits/submission/${submission.id}/score`, { score: n });
      toast.success(res.data.message);
      onScored();
      setScore('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Scoring failed');
    } finally {
      setScoring(false);
    }
  };

  return (
    <div style={{
      marginTop: 16, padding: 16, borderRadius: 10,
      background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        🎯 Assign Score
      </div>

      {submission.teacher_score !== null && submission.teacher_score !== undefined && (
        <div style={{
          marginBottom: 10, fontSize: 12, padding: '6px 10px', borderRadius: 8,
          background: 'rgba(34,197,94,.1)', color: 'var(--color-green)',
        }}>
          ✅ Previously scored: <strong>{submission.teacher_score}/100</strong>
          {submission.scored_by && ` by ${submission.scored_by}`}
          {submission.scored_at && ` on ${formatDate(submission.scored_at)}`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="input"
          type="number"
          min="0"
          max="100"
          placeholder="Score 0–100"
          value={score}
          onChange={e => setScore(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleScore()}
          style={{ maxWidth: 120 }}
        />
        <button
          className="btn btn-primary"
          onClick={handleScore}
          disabled={scoring || score === ''}
          style={{ fontSize: 13 }}
        >
          {scoring ? 'Applying…' : 'Apply Score'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminEditDashboard() {
  const [submissions, setSubmissions] = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [timeline,    setTimeline]    = useState([]);
  const [diffPair,    setDiffPair]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [analyzing,   setAnalyzing]   = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/edits/submissions');
      setSubmissions(res.data.data || []);
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const openSubmission = async (sub) => {
    setSelected(sub);
    try {
      const res = await api.get(`/edits/submission/${sub.id}`);
      setTimeline(res.data.data.timeline || []);
    } catch {
      toast.error('Failed to load timeline');
    }
  };

  const handleScored = async () => {
    await fetchSubmissions();
    if (selected) {
      const res = await api.get(`/edits/submission/${selected.id}`);
      setSelected(res.data.data);
      setTimeline(res.data.data.timeline || []);
    }
  };

  const analyzeAI = async (subId) => {
    setAnalyzing(true);
    try {
      const res = await api.post(`/edits/analyze/${subId}`);
      const d   = res.data.data;
      toast.success(d.label);
      await fetchSubmissions();
      if (selected?.id === subId) {
        setSelected(prev => ({ ...prev, ai_score: d.ai_score, ai_flagged: d.ai_flagged }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      {diffPair && (
        <DiffViewer
          evA={diffPair[0]}
          evB={diffPair[1]}
          onClose={() => setDiffPair(null)}
        />
      )}

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Edit Tracking</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 28 }}>
        Monitor submissions, detect AI content, compare versions, and assign scores.
      </p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Submissions list */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 14, overflow: 'hidden', flex: '0 0 340px', minWidth: 280,
        }}>
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--color-border)',
            fontWeight: 600, fontSize: 15,
          }}>
            All Submissions ({submissions.length})
          </div>

          {loading ? (
            <div style={{ padding: 24, color: 'var(--color-muted)' }}>Loading…</div>
          ) : submissions.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--color-muted)', fontSize: 13 }}>
              No submissions yet.
            </div>
          ) : (
            submissions.map(sub => (
              <div key={sub.id} onClick={() => openSubmission(sub)} style={{
                padding: '14px 18px', cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                background: selected?.id === sub.id ? 'rgba(99,102,241,.08)' : 'transparent',
                borderLeft: selected?.id === sub.id
                  ? '3px solid var(--color-primary)'
                  : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{sub.title}</div>
                  <AIBadge score={sub.ai_score} flagged={sub.ai_flagged} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                  {sub.user_name} · {sub.content_type}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                    {sub.edit_count} edits · {formatDate(sub.updated_at)}
                  </span>
                  {sub.teacher_score !== null && sub.teacher_score !== undefined && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-green)' }}>
                      Score: {sub.teacher_score}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 14, padding: 20, marginBottom: 16,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', flexWrap: 'wrap', gap: 12,
              }}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                    {selected.title}
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    By {selected.user_name} · {selected.content_type}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <AIBadge score={selected.ai_score} flagged={selected.ai_flagged} />
                  <button className="btn btn-primary"
                    onClick={() => analyzeAI(selected.id)}
                    disabled={analyzing}
                    style={{ fontSize: 13, padding: '8px 16px' }}>
                    {analyzing ? '🔍 Analyzing…' : '🤖 Run AI Detection'}
                  </button>
                </div>
              </div>

              {/* Final text */}
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  marginBottom: 6, color: 'var(--color-muted)',
                }}>
                  FINAL SUBMISSION
                </div>
                <div style={{
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.6,
                  maxHeight: 150, overflowY: 'auto', whiteSpace: 'pre-wrap',
                }}>
                  {selected.final_text || '(empty)'}
                </div>
              </div>

              {/* Score panel */}
              <ScorePanel submission={selected} onScored={handleScored} />
            </div>

            {/* Timeline */}
            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 14, padding: 20,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                Edit Timeline ({timeline.length} events)
              </h3>
              {timeline.length === 0 ? (
                <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>
                  No edit events recorded.
                </p>
              ) : (
                <Timeline
                  events={timeline}
                  onCompare={(a, b) => setDiffPair([a, b])}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}