import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Users, UserPlus, Clock, BookOpen,
  ScanLine, Bot, Repeat2, X,
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

function StatusBadge({ status }) {
  if (status === 'graded')    return <span className="badge badge-success">Graded</span>;
  if (status === 'submitted') return <span className="badge badge-info">Submitted</span>;
  return <span className="badge badge-warning">Draft</span>;
}

/* ── Group manager (teacher assigns students to a group) ── */
function GroupManager({ assignmentId, onClose, onChanged }) {
  const [students, setStudents] = useState([]);
  const [selected,  setSelected]  = useState([]);
  const [groups,    setGroups]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/courses/mine/students'),
      api.get(`/assignments/${assignmentId}/groups`),
    ]).then(([usersRes, groupsRes]) => {
      setStudents(usersRes.data?.data ?? []);
      setGroups(groupsRes.data?.data ?? []);
    }).catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const toggleStudent = id =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const assignedIds = new Set(groups.flatMap(g => g.members.map(m => m.user_id)));

  const handleCreate = async () => {
    if (selected.length < 2) { toast.error('Select at least 2 students'); return; }
    try {
      await api.post(`/assignments/${assignmentId}/groups`, { student_ids: selected });
      toast.success('Group created — students notified!');
      const res = await api.get(`/assignments/${assignmentId}/groups`);
      setGroups(res.data?.data ?? []);
      setSelected([]);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    }
  };

  return (
    <div className="group-manager card">
      <div className="flex-between mb-16">
        <h4 style={{ fontSize: '0.95rem' }}>Assign Student Groups</h4>
        <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
      </div>

      {loading && <p className="text-sm text-muted">Loading students...</p>}

      {!loading && (
        <>
          {groups.length > 0 && (
            <div className="existing-groups mb-16">
              <p className="text-xs text-muted mb-8">Existing groups</p>
              {groups.map((g, i) => (
                <div key={g.id} className="group-chip">
                  <Users size={12} />
                  Group {i + 1}: {g.members.map(m => m.full_name).join(', ')}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted mb-8">Select students for a new group:</p>
          <div className="student-picker">
            {students
              .filter(s => !assignedIds.has(s.id))
              .map(s => (
                <label key={s.id} className="student-pick-item">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                  />
                  {s.full_name}
                </label>
              ))}
            {students.filter(s => !assignedIds.has(s.id)).length === 0 && (
              <p className="text-sm text-muted">All students have been assigned.</p>
            )}
          </div>

          <button className="btn btn-primary btn-sm mt-16" onClick={handleCreate}
            disabled={selected.length < 2}>
            <UserPlus size={14} /> Create Group ({selected.length} selected)
          </button>
        </>
      )}
    </div>
  );
}

export default function AssignmentSubmissionsPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [assignment,  setAssignment]  = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showGroups,  setShowGroups]  = useState(false);
  const [scanningId,  setScanningId]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        api.get(`/assignments/${assignmentId}`),
        api.get(`/assignments/${assignmentId}/submissions?per_page=100`),
      ]);
      setAssignment(aRes.data?.data ?? null);
      setSubmissions(sRes.data?.data?.items ?? []);
    } catch {
      toast.error('Failed to load assignment');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => { load(); }, [load]);

  const handleScan = async (e, submissionId) => {
    e.stopPropagation();
    setScanningId(submissionId);
    try {
      const res  = await api.post(`/ai/scan/${submissionId}`);
      const data = res.data?.data ?? {};
      setSubmissions(prev => prev.map(s =>
        s.id === submissionId
          ? { ...s, ai_score: data.ai_score, similarity_score: data.similarity_score, flagged: data.flagged }
          : s
      ));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Scan failed');
    } finally {
      setScanningId(null);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading assignment...</div>;
  if (!assignment) return <div style={{ padding: 40 }}>Assignment not found.</div>;

  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();

  return (
    <div className="assignments-page">
      <button className="btn btn-ghost btn-sm mb-16" onClick={() => navigate('/assignments')}>
        <ArrowLeft size={14} /> Back to Assignments
      </button>

      <div className="card mb-24">
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 6 }}>{assignment.title}</h1>
            <div className="flex-center gap-8" style={{ flexWrap: 'wrap' }}>
              {assignment.course_code && (
                <span className="badge badge-info"><BookOpen size={9} /> {assignment.course_code}</span>
              )}
              {assignment.is_group && <span className="badge badge-info"><Users size={10} /> Group</span>}
              {assignment.difficulty && <span className="badge badge-neutral">{assignment.difficulty}</span>}
              {assignment.due_date && (
                <span className={`text-xs flex-center gap-8 ${isOverdue ? 'text-danger' : 'text-muted'}`}>
                  <Clock size={12} /> Due: {new Date(assignment.due_date).toLocaleDateString()}
                </span>
              )}
              <span className="text-xs text-muted">Max score: {assignment.max_score}</span>
            </div>
          </div>
          {assignment.is_group && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowGroups(s => !s)}>
              <Users size={14} /> Manage Groups
            </button>
          )}
        </div>
        {assignment.description && <p className="text-sm text-muted mt-16">{assignment.description}</p>}
      </div>

      {showGroups && (
        <div className="mb-24">
          <GroupManager assignmentId={assignmentId} onClose={() => setShowGroups(false)} onChanged={load} />
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '0.95rem' }}>Submissions ({submissions.length})</h3>
        </div>

        {submissions.length === 0 ? (
          <p className="text-muted text-sm" style={{ padding: 20 }}>No submissions yet.</p>
        ) : (
          submissions.map(s => {
            const scanning = scanningId === s.id;
            const name = s.group_members
              ? s.group_members.map(m => m.full_name).join(' & ')
              : (s.student?.full_name || 'Student');

            return (
              <div
                key={s.id}
                className="submission-row"
                style={{ margin: '0 16px', cursor: 'pointer' }}
                onClick={() => navigate(`/assignments/${assignmentId}/submissions/${s.id}`)}
              >
                <div className="submission-row-header">
                  <div>
                    <p className="text-sm" style={{ fontWeight: 600 }}>{name}</p>
                    <p className="text-xs text-muted">
                      {s.submitted_at ? `Submitted ${new Date(s.submitted_at).toLocaleString()}` : 'Draft'}
                      {s.is_late && <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: '0.65rem' }}>Late</span>}
                      {s.flagged && <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: '0.65rem' }}>Flagged</span>}
                    </p>
                  </div>
                  <div className="flex-center gap-12">
                    {s.ai_score !== undefined && s.ai_score !== null ? (
                      <div className="flex-col" style={{ gap: 4 }}>
                        <span className={`badge ${s.ai_score > 60 ? 'badge-danger' : 'badge-success'}`}>
                          <Bot size={10} /> AI: {s.ai_score}%
                        </span>
                        {s.similarity_score > 0 && (
                          <span className={`badge ${s.similarity_score > 50 ? 'badge-warning' : 'badge-neutral'}`}>
                            <Repeat2 size={10} /> {s.similarity_score}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={scanning || !s.content}
                        onClick={(e) => handleScan(e, s.id)}
                      >
                        <ScanLine size={13} /> {scanning ? 'Scanning…' : 'Check AI/Plag'}
                      </button>
                    )}
                    <StatusBadge status={s.status} />
                    <ChevronRight size={16} className="text-muted" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
