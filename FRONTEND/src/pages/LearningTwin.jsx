import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Sparkles, RotateCcw, Gauge, HeartPulse, Clock, BookOpen,
  Star, Repeat, AlertTriangle, Rocket,
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './LearningTwin.css';

const PACE_META = {
  fast:   { label: 'Fast',   color: 'var(--color-success)' },
  steady: { label: 'Steady', color: 'var(--color-info)'    },
  slow:   { label: 'Building up', color: 'var(--color-warning)' },
};

const CONFIDENCE_META = {
  high:   { label: 'High',   color: 'var(--color-success)' },
  medium: { label: 'Medium', color: 'var(--color-warning)' },
  low:    { label: 'Growing', color: 'var(--color-danger)'  },
};

function TraitCard({ icon: Icon, label, value, color, note }) {
  return (
    <div className="card twin-trait-card">
      <div className="stat-icon" style={{ background: color ? `${color}22` : undefined, color: color || undefined }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="stat-value" style={{ fontSize: '1.15rem', color: color || undefined }}>{value || 'Not enough data yet'}</div>
        <div className="stat-label">{label}</div>
        {note && <p className="text-xs text-muted mt-4">{note}</p>}
      </div>
    </div>
  );
}

function TopicList({ items, emptyText, renderReason }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted">{emptyText}</p>;
  }
  return (
    <div className="flex-col gap-8">
      {items.map((item, i) => (
        <div key={i} className="twin-topic-row">
          <div>
            <span className="text-sm" style={{ fontWeight: 600 }}>{item.title}</span>
            <span className="badge badge-neutral" style={{ marginLeft: 8, fontSize: '0.65rem' }}>{item.track}</span>
          </div>
          {renderReason && <span className="text-xs text-muted">{renderReason(item)}</span>}
        </div>
      ))}
    </div>
  );
}

export default function LearningTwinPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/learning-twin/me')
      .then(res => setProfile(res.data?.data ?? null))
      .catch(err => toast.error(err.response?.data?.error || 'Failed to load your Learning Twin'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.post('/learning-twin/refresh');
      setProfile(res.data?.data ?? null);
      toast.success('Learning Twin refreshed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Building your Learning Twin...</div>;
  if (!profile) return <div style={{ padding: 40 }}>Could not load your Learning Twin.</div>;

  const pace = PACE_META[profile.pace];
  const confidence = CONFIDENCE_META[profile.confidence_level];
  const isColdStart = profile.data_points < 10;

  return (
    <div className="learning-twin-page">
      <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brain size={26} /> Your Learning Twin
          </h1>
          <p className="text-muted text-sm mt-4">
            A living profile of how you learn, built from your activity — not a quiz you fill out.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={refreshing}>
          <RotateCcw size={13} /> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {profile.computed_at && (
        <p className="text-xs text-muted mb-24">
          Last updated {new Date(profile.computed_at).toLocaleString()}
        </p>
      )}

      {isColdStart && (
        <div className="info-banner mb-24">
          <Sparkles size={16} />
          <span>
            Your Learning Twin is just getting started — the more you use SkillSync (assignments, quizzes, study sessions),
            the sharper and more personal it gets.
          </span>
        </div>
      )}

      {/* AI Summary */}
      <div className="card twin-summary-card mb-24">
        <div className="flex-center gap-8 mb-8">
          <Sparkles size={16} className="text-primary" />
          <span className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            AI Summary
          </span>
        </div>
        <p style={{ fontSize: '1.02rem', lineHeight: 1.6 }}>{profile.ai_summary}</p>
      </div>

      {/* Trait cards */}
      <div className="grid-4 mb-24" style={{ gap: 14 }}>
        <TraitCard icon={BookOpen}   label="Learning Style" value={profile.learning_style} note={profile.learning_style_note} />
        <TraitCard icon={Gauge}      label="Pace"            value={pace?.label}       color={pace?.color} />
        <TraitCard icon={HeartPulse} label="Confidence"      value={confidence?.label} color={confidence?.color} />
        <TraitCard icon={Clock}      label="Best Study Times" value={profile.best_study_times?.[0]} />
      </div>

      {/* Recommendations */}
      {profile.ai_recommendations?.length > 0 && (
        <div className="card mb-24">
          <h3 className="mb-16 flex-center gap-8" style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
            <Rocket size={16} /> Recommended Next Steps
          </h3>
          <div className="flex-col gap-12">
            {profile.ai_recommendations.map((rec, i) => (
              <div key={i} className="twin-rec-row">
                <span className="twin-rec-num">{i + 1}</span>
                <span className="text-sm">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: 16 }}>
        {/* Strengths */}
        <div className="card">
          <h3 className="mb-16 flex-center gap-8" style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
            <Star size={15} className="text-primary" /> What You Know Well
          </h3>
          <TopicList
            items={profile.strengths}
            emptyText="Complete a few roadmap steps in your courses to see your strengths here."
            renderReason={item => `${item.mastery_score}%`}
          />
        </div>

        {/* Areas needing revision */}
        <div className="card">
          <h3 className="mb-16 flex-center gap-8" style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
            <AlertTriangle size={15} style={{ color: 'var(--color-warning)' }} /> Areas Needing Revision
          </h3>
          <TopicList
            items={profile.revision_needed}
            emptyText="Nothing flagged for revision right now — nice work."
            renderReason={item => item.reason}
          />
        </div>
      </div>

      {/* Forgetting patterns */}
      {profile.forgetting_patterns?.length > 0 && (
        <div className="card mt-16">
          <h3 className="mb-16 flex-center gap-8" style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
            <Repeat size={15} style={{ color: 'var(--color-danger)' }} /> Topics You Tend to Forget
          </h3>
          <p className="text-xs text-muted mb-12">
            These took multiple attempts to master — a quick periodic review could help it stick.
          </p>
          <TopicList
            items={profile.forgetting_patterns}
            emptyText=""
            renderReason={item => `${item.attempts} attempts`}
          />
        </div>
      )}
    </div>
  );
}
