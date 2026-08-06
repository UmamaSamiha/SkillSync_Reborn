import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Star, AlertTriangle, BarChart3, RotateCcw, Users2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const TREND_META = {
  rising:  { icon: TrendingUp,   color: 'var(--color-success)' },
  falling: { icon: TrendingDown, color: 'var(--color-danger)'  },
  stable:  { icon: Minus,        color: 'var(--color-text-muted)' },
};

const CLASS_META = {
  'Consistent Performer': { icon: Star,          badge: 'badge-success' },
  'Improving':            { icon: TrendingUp,    badge: 'badge-info'    },
  'Declining':            { icon: TrendingDown,  badge: 'badge-warning' },
  'At-Risk':              { icon: AlertTriangle, badge: 'badge-danger'  },
  'Average':              { icon: BarChart3,     badge: 'badge-neutral' },
};

function TrendBar({ data = [] }) {
  if (!data.length) return <p className="text-xs text-muted">No grade history yet</p>;
  const max = Math.max(...data.map(d => d.percentage), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
      {data.slice(-10).map((d, i) => (
        <div
          key={i}
          title={`${d.percentage.toFixed(0)}%`}
          style={{
            flex: 1, minHeight: 3,
            height: `${Math.max(8, (d.percentage / max) * 40)}px`,
            background: d.percentage >= 70 ? 'var(--color-primary)' : d.percentage >= 50 ? 'var(--color-primary-light)' : 'var(--color-danger-light)',
            borderRadius: '3px 3px 0 0',
          }}
        />
      ))}
    </div>
  );
}

export default function TeacherPerformancePage() {
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await api.get('/admin/student-classification');
      const list = res.data?.data ?? [];

      const withTrends = await Promise.all(
        list.map(async s => {
          try {
            const perf = await api.get(`/analytics/performance/${s?.user?.id}`);
            return { ...s, trend: perf.data?.data?.trend ?? [] };
          } catch {
            return { ...s, trend: [] };
          }
        })
      );
      setStudents(withTrends);
    } catch {
      toast.error('Failed to load performance data');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <div className="flex-between mb-16">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={24} /> Performance & Grade Prediction
          </h1>
          <p className="text-muted text-sm mt-4">Trends and predicted grades for students in your courses.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RotateCcw size={13} /> Refresh
        </button>
      </div>

      {loading && <p className="text-muted">Loading performance data...</p>}

      {!loading && students.length === 0 && (
        <div className="text-center text-muted" style={{ padding: '60px 0' }}>
          <Users2 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No students enrolled in your courses yet.</p>
        </div>
      )}

      <div className="flex-col gap-12">
        {students.map((s, i) => {
          const trendMeta = TREND_META[s.grade_trend] || TREND_META.stable;
          const classMeta = CLASS_META[s.classification] || CLASS_META.Average;
          return (
            <div key={s?.user?.id || i} className="card">
              <div className="flex-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div className="flex-center gap-12">
                  <div className="avatar">{(s?.user?.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s?.user?.full_name}</div>
                    <div className="text-xs text-muted">{s?.user?.email}</div>
                  </div>
                </div>
                <div className="flex-center gap-8">
                  <span className="badge badge-neutral">
                    <trendMeta.icon size={11} style={{ color: trendMeta.color }} /> {s.grade_trend || 'stable'}
                  </span>
                  <span className={`badge ${classMeta.badge}`}>
                    <classMeta.icon size={11} /> {s.classification}
                  </span>
                </div>
              </div>

              <div className="flex-between mt-16" style={{ flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <p className="text-xs text-muted mb-4">GRADE TREND (last 10)</p>
                  <TrendBar data={s.trend} />
                </div>
                <div className="flex-center gap-20">
                  <div>
                    <p className="text-xs text-muted">AVERAGE</p>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-primary)' }}>{s.avg_grade ?? 0}%</p>
                  </div>
                  {s.predicted_grade != null && (
                    <div>
                      <p className="text-xs text-muted">PREDICTED</p>
                      <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-accent)' }}>{s.predicted_grade}%</p>
                    </div>
                  )}
                  {s.study_hours != null && (
                    <div>
                      <p className="text-xs text-muted">STUDY HRS</p>
                      <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{s.study_hours}h</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
