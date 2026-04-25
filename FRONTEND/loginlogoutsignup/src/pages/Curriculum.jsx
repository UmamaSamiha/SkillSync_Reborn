import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const STATUS = {
  locked:      { icon: '🔒', label: 'Locked',                              color: 'var(--color-muted)',   bg: 'rgba(139,146,165,.08)' },
  unlocked:    { icon: '🔓', label: 'Submit work to teacher for scoring',  color: 'var(--color-amber)',   bg: 'rgba(245,158,11,.08)'  },
  in_progress: { icon: '⚡', label: 'Awaiting teacher score',              color: 'var(--color-primary)', bg: 'rgba(99,102,241,.08)'  },
  mastered:    { icon: '✅', label: 'Mastered',                            color: 'var(--color-green)',   bg: 'rgba(34,197,94,.08)'   },
};

function TopicCard({ topic, index }) {
  const navigate = useNavigate();
  const st = STATUS[topic.user_status] || STATUS.locked;

  return (
    <div style={{
      background: st.bg,
      border: `1px solid ${topic.user_status === 'mastered' ? 'rgba(34,197,94,.3)' : 'var(--color-border)'}`,
      borderRadius: 14,
      padding: 20,
      opacity: topic.user_status === 'locked' ? 0.6 : 1,
      transition: 'opacity .2s, border-color .2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

        {/* Step number */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: topic.user_status === 'mastered' ? 'var(--color-green)' : 'var(--color-surface)',
          border: `2px solid ${st.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
          color: topic.user_status === 'mastered' ? '#fff' : st.color,
        }}>
          {topic.user_status === 'mastered' ? '✓' : index + 1}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{topic.title}</h3>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: 'var(--color-surface)', color: st.color,
              border: `1px solid ${st.color}33`,
            }}>
              {st.icon} {st.label}
            </span>
            {topic.user_score != null && (
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                Best: <strong style={{ color: st.color }}>{topic.user_score}</strong>/100
              </span>
            )}
          </div>

          {topic.description && (
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>
              {topic.description}
            </p>
          )}

          {topic.prerequisite_ids?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Requires:</span>
              {topic.prerequisite_ids.map(pid => (
                <span key={pid} style={{
                  fontSize: 11, padding: '1px 6px', borderRadius: 4,
                  background: 'var(--color-surface)', color: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                }}>
                  Topic #{pid}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Submit Work button — only for unlocked/in_progress */}
        {(topic.user_status === 'unlocked' || topic.user_status === 'in_progress') && (
          <button
            className="btn btn-primary"
            onClick={() => navigate('/submit')}
            style={{ fontSize: 12, padding: '6px 14px', flexShrink: 0 }}
          >
            📝 Submit Work
          </button>
        )}
      </div>

      {/* Score bar — only show if scored */}
      {topic.user_score != null && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 4, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${topic.user_score}%`,
              background: topic.user_status === 'mastered' ? 'var(--color-green)' : 'var(--color-primary)',
              transition: 'width .4s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>0</span>
            <span style={{ fontSize: 10, color: st.color }}>Mastery: {topic.mastery_threshold}</span>
            <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>100</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackSection({ track, topics }) {
  const mastered = topics.filter(t => t.user_status === 'mastered').length;
  const total    = topics.length;
  const pct      = Math.round((mastered / total) * 100);

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{track}</h2>
        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          {mastered} / {total} mastered
        </span>
        <div style={{ flex: 1, minWidth: 100 }}>
          <div style={{ height: 6, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${pct}%`,
              background: pct === 100 ? 'var(--color-green)' : 'var(--color-primary)',
              transition: 'width .4s',
            }} />
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? 'var(--color-green)' : 'var(--color-primary)' }}>
          {pct}%
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {topics.map((topic, i) => (
          <div key={topic.id}>
            <TopicCard topic={topic} index={i} />
            {i < topics.length - 1 && (
              <div style={{
                display: 'flex', justifyContent: 'flex-start',
                paddingLeft: 36, height: 24, alignItems: 'center',
              }}>
                <div style={{
                  width: 2, height: 24,
                  background: topics[i].user_status === 'mastered'
                    ? 'var(--color-green)' : 'var(--color-border)',
                  transition: 'background .4s',
                }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CurriculumPage() {
  const [topics,  setTopics]  = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await api.get('/curriculum/topics');
      setTopics(res.data.data || []);
    } catch {
      toast.error('Failed to load curriculum');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const grouped = topics.reduce((acc, t) => {
    (acc[t.track] = acc[t.track] || []).push(t);
    return acc;
  }, {});

  const totalMastered = topics.filter(t => t.user_status === 'mastered').length;
  const totalUnlocked = topics.filter(t => t.user_status === 'unlocked' || t.user_status === 'in_progress').length;
  const totalLocked   = topics.filter(t => t.user_status === 'locked').length;

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--color-muted)' }}>Loading curriculum…</div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Learning Path</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 28 }}>
        Submit your work to your teacher. They will score it and unlock your next topic.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
        {[
          { label: 'Mastered',    value: totalMastered, color: 'var(--color-green)'   },
          { label: 'In Progress', value: totalUnlocked, color: 'var(--color-primary)' },
          { label: 'Locked',      value: totalLocked,   color: 'var(--color-muted)'   },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, padding: '14px 20px', minWidth: 120,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No topics available yet.</p>
      ) : (
        Object.entries(grouped).map(([track, trackTopics]) => (
          <TrackSection key={track} track={track} topics={trackTopics} />
        ))
      )}
    </div>
  );
}