import { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronUp, Clock, FileText } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Contributions.css';

function ContribBar({ pct, color }) {
  return (
    <div className="progress-bar" style={{ flex: 1 }}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const MEMBER_COLORS = ['#893941', '#5E6623', '#4A6B8A', '#C17B3A', '#7B5EA7'];

function AssignmentCard({ assignment }) {
  const [expanded, setExpanded] = useState(false);
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  const fetchContribs = async () => {
    if (data) return;
    setLoading(true);
    try {
      const res = await api.get(`/timelogs/assignment/${assignment.id}/contributions`);
      setData(res.data?.data);
    } catch {
      toast.error('Failed to load contributions');
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = () => {
    setExpanded(e => !e);
    if (!expanded) fetchContribs();
  };

  const due = assignment.due_date
    ? new Date(assignment.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <div className={`contrib-card card ${expanded ? 'expanded' : ''}`}>
      <div className="contrib-header" onClick={handleExpand}>
        <div className="flex-center gap-12">
          <FileText size={18} className="text-primary" />
          <div>
            <p className="contrib-title">{assignment.title}</p>
            <div className="flex-center gap-8 mt-4">
              <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                <Users size={10} /> Group Assignment
              </span>
              <span className="text-xs text-muted">Due: {due}</span>
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className="contrib-body">
          {loading && <p className="text-sm text-muted">Loading contributions...</p>}

          {data && data.members.length === 0 && (
            <p className="text-sm text-muted">No submissions yet.</p>
          )}

          {data && data.members.length > 0 && (
            <>
              <div className="contrib-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Contribution</th>
                      <th>Chars Written</th>
                      <th>Time Spent</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m, i) => (
                      <tr key={m.user_id}>
                        <td style={{ fontWeight: 600 }}>{m.full_name}</td>
                        <td>
                          <div className="flex-center gap-8">
                            <ContribBar pct={m.contribution_pct} color={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                            <span className="text-xs" style={{ minWidth: 36, textAlign: 'right', fontWeight: 600 }}>
                              {m.contribution_pct}%
                            </span>
                          </div>
                        </td>
                        <td className="text-muted">{m.chars_written.toLocaleString()} chars</td>
                        <td>
                          <span className="flex-center gap-4 text-muted">
                            <Clock size={12} />
                            {m.time_spent_minutes > 0 ? `${m.time_spent_minutes} min` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${
                            m.submission_status === 'graded'    ? 'badge-success' :
                            m.submission_status === 'submitted' ? 'badge-info'    :
                            m.submission_status === 'draft'     ? 'badge-warning' : 'badge-neutral'
                          }`}>
                            {m.submission_status ?? 'Not started'}
                            {m.score != null && ` · ${m.score}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Visual contribution summary */}
              <div className="contrib-visual">
                <p className="text-xs text-muted mb-16">Relative writing contribution</p>
                <div className="contrib-stacked-bar">
                  {data.members.map((m, i) => (
                    m.contribution_pct > 0 && (
                      <div
                        key={m.user_id}
                        className="stacked-segment"
                        style={{ width: `${m.contribution_pct}%`, background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                        title={`${m.full_name}: ${m.contribution_pct}%`}
                      />
                    )
                  ))}
                </div>
                <div className="contrib-legend">
                  {data.members.map((m, i) => (
                    <span key={m.user_id} className="legend-item">
                      <span className="legend-dot" style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }} />
                      {m.full_name}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ContributionsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    api.get('/assignments/?per_page=50')
      .then(res => {
        const all = res.data?.data?.items ?? [];
        setAssignments(all.filter(a => a.is_group));
      })
      .catch(() => toast.error('Failed to load assignments'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="contributions-page">
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>Member Contributions</h1>
      <p className="text-muted text-sm mb-24">
        Per-member breakdown of writing contribution and time spent on group assignments.
      </p>

      {loading && <p className="text-muted">Loading...</p>}

      {!loading && assignments.length === 0 && (
        <div className="card text-center" style={{ padding: '48px 24px', color: 'var(--color-text-muted)' }}>
          <Users size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No group assignments yet.</p>
        </div>
      )}

      <div className="contributions-list">
        {assignments.map(a => <AssignmentCard key={a.id} assignment={a} />)}
      </div>
    </div>
  );
}
