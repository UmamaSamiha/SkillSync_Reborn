import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, Clock, Plus, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function StatCard({ icon: Icon, value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}20`, color }}>
        <Icon size={20} />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    api.get('/assignments/?per_page=50')
      .then(res => setAssignments(res.data?.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending = assignments.reduce((acc, a) => acc + (a.pending_count ?? 0), 0);
  const overdue = assignments.filter(a => a.due_date && new Date(a.due_date) < new Date()).length;

  const firstName = user?.full_name?.split(' ')[0] ?? 'Teacher';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <div className="mb-24">
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>
          Welcome back, {firstName}
        </h1>
        <p className="text-muted text-sm">Here's an overview of your assignments and student activity.</p>
      </div>

      <div className="grid-3 mb-24">
        <StatCard icon={FileText} value={assignments.length} label="Total Assignments" color="var(--color-primary)" />
        <StatCard icon={Clock}    value={pending}            label="Pending Grading"   color="var(--color-warning)" />
        <StatCard icon={Users}    value={overdue}            label="Overdue Assignments" color="var(--color-danger)" />
      </div>

      <div className="card">
        <div className="flex-between mb-24">
          <h3 style={{ fontFamily: 'var(--font-display)' }}>Recent Assignments</h3>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/assignments')}>
            <Plus size={14} /> New Assignment
          </button>
        </div>

        {loading && <p className="text-muted text-sm">Loading...</p>}

        {!loading && assignments.length === 0 && (
          <div className="text-center text-muted" style={{ padding: '40px 0' }}>
            <FileText size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
            <p>No assignments yet. Create your first one!</p>
          </div>
        )}

        {!loading && assignments.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Due Date</th>
                <th>Max Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.slice(0, 10).map(a => {
                const isOverdue = a.due_date && new Date(a.due_date) < new Date();
                return (
                  <tr key={a.id} style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/assignments')}>
                    <td style={{ fontWeight: 500 }}>{a.title}</td>
                    <td>
                      <span className={`badge ${
                        a.difficulty === 'beginner'     ? 'badge-success' :
                        a.difficulty === 'advanced'     ? 'badge-danger'  : 'badge-warning'
                      }`}>
                        {a.difficulty ?? 'intermediate'}
                      </span>
                    </td>
                    <td style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {a.due_date
                        ? new Date(a.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                      {isOverdue && ' (Overdue)'}
                    </td>
                    <td className="text-muted">{a.max_score} pts</td>
                    <td><ChevronRight size={14} style={{ color: 'var(--color-text-light)' }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {assignments.length > 10 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/assignments')}>
              View all {assignments.length} assignments
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
