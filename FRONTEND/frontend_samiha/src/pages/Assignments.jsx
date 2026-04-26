import { useState, useEffect } from 'react';
import {
  FileText, Clock, ChevronDown, ChevronUp,
  Send, Plus, X, Star, AlertCircle, Users, UserPlus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Assignments.css';

/* ── Small helpers ──────────────────────────────────────── */
function StatusBadge({ sub }) {
  if (!sub)                       return <span className="badge badge-neutral">Not started</span>;
  if (sub.status === 'graded')    return <span className="badge badge-success">Graded: {sub.score}</span>;
  if (sub.status === 'submitted') return <span className="badge badge-info">Submitted</span>;
  return <span className="badge badge-warning">Draft</span>;
}

/* ── Group manager (teacher assigns students to a group) ── */
function GroupManager({ assignmentId, onClose }) {
  const [students,  setStudents]  = useState([]);
  const [selected,  setSelected]  = useState([]);
  const [groups,    setGroups]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users/?role=student&per_page=100'),
      api.get(`/assignments/${assignmentId}/groups`),
    ]).then(([usersRes, groupsRes]) => {
      setStudents(usersRes.data?.data?.items ?? []);
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

/* ── Contribution bar (for teacher view) ────────────────── */
function ContribRow({ member, total, color }) {
  const pct = total > 0 ? Math.round(member.chars_written / total * 100) : 0;
  return (
    <div className="contrib-inline-row">
      <span className="contrib-inline-name">{member.full_name}</span>
      <div className="progress-bar" style={{ flex: 1 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-muted" style={{ minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

const COLORS = ['#893941', '#5E6623', '#4A6B8A', '#C17B3A', '#7B5EA7'];

/* ══════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════ */
export default function AssignmentsPage() {
  const { isTeacher, isAdmin } = useAuth();
  const canManage = isTeacher || isAdmin;

  const [assignments, setAssignments] = useState([]);
  const [projects,    setProjects]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [content,     setContent]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [gradeData,   setGradeData]   = useState({});
  const [showCreate,  setShowCreate]  = useState(false);
  const [groupMgr,    setGroupMgr]    = useState(null); // assignment id showing group mgr
  const [contribs,    setContribs]    = useState({});   // assignment_id → contrib data
  const [allStudents, setAllStudents] = useState([]);   // for group member picker in create form
  const [pickedStudents, setPickedStudents] = useState([]); // selected in create form

  const [form, setForm] = useState({
    project_id:  '',
    title:       '',
    description: '',
    due_date:    '',
    max_score:   '100',
    difficulty:  'intermediate',
    is_group:    false,
  });

  const fetchAssignments = async () => {
    try {
      const res = await api.get('/assignments/?per_page=50');
      setAssignments(res.data.data.items || []);
    } catch {
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    if (!canManage) return;
    try {
      const res = await api.get('/users/me/projects');
      const data = res.data?.data;
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      setProjects(items);
    } catch {}
  };

  useEffect(() => {
    fetchAssignments();
    fetchProjects();
    if (canManage) {
      api.get('/users/?role=student&per_page=100')
        .then(r => setAllStudents(r.data?.data?.items ?? []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select the only project
  useEffect(() => {
    if (projects.length === 1 && !form.project_id) {
      setForm(f => ({ ...f, project_id: projects[0].id }));
    }
  }, [projects]); // eslint-disable-line

  const toggleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setContent('');

    try {
      const res   = await api.get(`/assignments/${id}/submissions`);
      const items = res.data.data.items || [];

      if (canManage) {
        setSubmissions(prev => ({ ...prev, [id]: items }));
        // Fetch contribution data for group assignments
        const a = assignments.find(x => x.id === id);
        if (a?.is_group && !contribs[id]) {
          api.get(`/timelogs/assignment/${id}/contributions`)
            .then(r => setContribs(prev => ({ ...prev, [id]: r.data?.data })))
            .catch(() => {});
        }
      } else if (items.length > 0) {
        setSubmissions(prev => ({ ...prev, [id]: items[0] }));
        setContent(items[0].content || '');
      }
    } catch {}
  };

  const handleSubmit = async (assignmentId, isDraft = false) => {
    setSubmitting(true);
    try {
      await api.post(`/assignments/${assignmentId}/submissions`, {
        content,
        submit: !isDraft,
      });
      toast.success(isDraft ? 'Draft saved!' : 'Submitted — teacher notified!');
      setExpanded(null);
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.project_id) { toast.error('No project found — contact admin.'); return; }
    if (form.is_group && pickedStudents.length < 2) {
      toast.error('Select at least 2 group members');
      return;
    }

    try {
      const res = await api.post('/assignments/', {
        project_id:  form.project_id,
        title:       form.title.trim(),
        description: form.description,
        due_date:    form.due_date ? new Date(form.due_date).toISOString() : null,
        max_score:   parseFloat(form.max_score) || 100,
        difficulty:  form.difficulty,
        is_group:    form.is_group,
      });
      const newId = res.data?.data?.id;

      if (form.is_group && newId && pickedStudents.length >= 2) {
        await api.post(`/assignments/${newId}/groups`, { student_ids: pickedStudents });
        toast.success('Group assignment created — members notified!');
      } else {
        toast.success('Assignment created — members notified.');
      }

      setShowCreate(false);
      setPickedStudents([]);
      setForm({ project_id: form.project_id, title: '', description: '', due_date: '', max_score: '100', difficulty: 'intermediate', is_group: false });
      await fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create');
    }
  };

  const handleGrade = async (submissionId, assignmentId) => {
    const d = gradeData[submissionId];
    if (!d?.score) { toast.error('Enter a score'); return; }
    try {
      await api.put(`/assignments/submissions/${submissionId}/grade`, {
        score:    parseFloat(d.score),
        feedback: d.feedback || '',
      });
      toast.success('Graded — student notified.');
      setExpanded(null);
      setTimeout(() => toggleExpand(assignmentId), 100);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Grading failed');
    }
  };

  const projectOptions = projects.length
    ? projects
    : Array.from(
        new Map(
          assignments
            .filter(a => a.project_id)
            .map(a => [a.project_id, { id: a.project_id, name: a.project_name || a.project_id }])
        ).values()
      );

  if (loading) return <div style={{ padding: 40 }}>Loading assignments...</div>;

  return (
    <div className="assignments-page">
      <div className="flex-between mb-24">
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Assignments</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Assignment</>}
          </button>
        )}
      </div>

      {/* ── Create Form ───────────────────────────────── */}
      {showCreate && canManage && (
        <form className="card create-form mb-24" onSubmit={handleCreate}>
          <h3 style={{ marginBottom: 16 }}>Create New Assignment</h3>

          {/* Group / Individual toggle */}
          <div className="login-field mb-16">
            <label>Assignment Type</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ val: false, label: 'Individual' }, { val: true, label: 'Group' }].map(opt => (
                <div
                  key={String(opt.val)}
                  onClick={() => setForm(f => ({ ...f, is_group: opt.val }))}
                  className={`type-toggle ${form.is_group === opt.val ? 'active' : ''}`}
                >
                  {opt.val ? <Users size={14} /> : <FileText size={14} />}
                  {opt.label}
                </div>
              ))}
            </div>
          </div>

          {/* Inline member picker for group assignments */}
          {form.is_group && (
            <div className="login-field mb-16">
              <label>Select Group Members * (min. 2)</label>
              <div className="student-picker">
                {allStudents.length === 0 && (
                  <p className="text-sm text-muted">Loading students...</p>
                )}
                {allStudents.map(s => (
                  <label key={s.id} className="student-pick-item">
                    <input
                      type="checkbox"
                      checked={pickedStudents.includes(s.id)}
                      onChange={() => setPickedStudents(prev =>
                        prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                      )}
                    />
                    {s.full_name}
                    <span className="text-xs text-muted" style={{ marginLeft: 4 }}>({s.email})</span>
                  </label>
                ))}
              </div>
              {pickedStudents.length > 0 && (
                <p className="text-xs text-muted mt-4">{pickedStudents.length} student(s) selected</p>
              )}
            </div>
          )}

          <div className="create-grid">
            <div className="login-field">
              <label>Title *</label>
              <input className="input" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Assignment title" required />
            </div>
            <div className="login-field">
              <label>Max Score</label>
              <input className="input" type="number" value={form.max_score}
                onChange={e => setForm({ ...form, max_score: e.target.value })} />
            </div>
            <div className="login-field">
              <label>Due Date</label>
              <input className="input" type="datetime-local" value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="login-field">
              <label>Difficulty</label>
              <select className="input" value={form.difficulty}
                onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          {projectOptions.length === 0 && (
            <div className="info-banner mt-8">
              <AlertCircle size={16} />
              <span>No projects found. Contact admin.</span>
            </div>
          )}

          <div className="login-field" style={{ marginTop: 12 }}>
            <label>Description</label>
            <textarea className="input" rows={3} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Assignment instructions..." />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}
            disabled={projectOptions.length === 0 || (form.is_group && pickedStudents.length < 2)}>
            <Plus size={16} /> {form.is_group
              ? `Create Group Assignment${pickedStudents.length >= 2 ? ` (${pickedStudents.length} members)` : ' — select members above'}`
              : 'Create Assignment'}
          </button>
        </form>
      )}

      {/* ── Assignment List ───────────────────────────── */}
      <div className="assignments-list">
        {assignments.map(a => {
          const isExp     = expanded === a.id;
          const sub       = !canManage ? submissions[a.id] : null;
          const allSubs   = canManage  ? (submissions[a.id] || []) : [];
          const isOverdue = a.due_date && new Date(a.due_date) < new Date();
          const contrib   = contribs[a.id];

          return (
            <div key={a.id} className={`assignment-card card ${isExp ? 'expanded' : ''}`}>
              <div className="assignment-header" onClick={() => toggleExpand(a.id)}>
                <div className="flex-center gap-12">
                  <FileText size={18} className="text-primary" />
                  <div>
                    <p className="assignment-title">{a.title}</p>
                    <div className="flex-center gap-8" style={{ marginTop: 2 }}>
                      {a.is_group && (
                        <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                          <Users size={10} /> Group
                        </span>
                      )}
                      {a.due_date && (
                        <span className={`text-xs flex-center gap-8 ${isOverdue ? 'text-danger' : 'text-muted'}`}>
                          <Clock size={12} />
                          Due: {new Date(a.due_date).toLocaleDateString()}
                          {isOverdue && ' (Overdue)'}
                        </span>
                      )}
                      {a.difficulty && (
                        <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                          {a.difficulty}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-center gap-12">
                  {!canManage && <StatusBadge sub={sub} />}
                  {isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {isExp && (
                <div className="assignment-body">
                  {a.description && <p className="text-sm text-muted mb-16">{a.description}</p>}

                  {/* Teacher tools */}
                  {canManage && a.is_group && (
                    <div className="mb-16">
                      <button className="btn btn-secondary btn-sm"
                        onClick={e => { e.stopPropagation(); setGroupMgr(groupMgr === a.id ? null : a.id); }}>
                        <Users size={14} /> Manage Groups
                      </button>
                    </div>
                  )}

                  {groupMgr === a.id && (
                    <GroupManager assignmentId={a.id} onClose={() => setGroupMgr(null)} />
                  )}

                  {/* Student submission area */}
                  {!canManage && (
                    <>
                      {sub?.group_members && (
                        <div className="group-info-banner mb-16">
                          <Users size={14} />
                          <span className="text-sm">
                            Group: {sub.group_members.map(m => m.full_name).join(', ')}
                          </span>
                        </div>
                      )}
                      {sub?.status === 'graded' && (
                        <div className="grade-box">
                          <p><strong>Score:</strong> {sub.score} / {a.max_score}</p>
                          {sub.feedback && <p><strong>Feedback:</strong> {sub.feedback}</p>}
                        </div>
                      )}
                      {sub?.status === 'submitted' && (
                        <div className="grade-box" style={{ background: 'var(--color-info-light)' }}>
                          <p className="text-sm">Your submission is awaiting review.</p>
                        </div>
                      )}
                      {(!sub || sub?.status === 'draft') && (
                        <div className="submission-form">
                          {a.is_group && (
                            <p className="text-xs text-muted mb-8">
                              This is a shared group draft — all members see and edit the same content.
                            </p>
                          )}
                          <label>Your Answer</label>
                          <textarea className="input" rows={5} value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Type your answer here..." />
                          <div className="flex-center gap-12 mt-16">
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => handleSubmit(a.id, true)} disabled={submitting}>
                              Save Draft
                            </button>
                            <button className="btn btn-primary btn-sm"
                              onClick={() => handleSubmit(a.id, false)} disabled={submitting}>
                              <Send size={14} /> {submitting ? 'Submitting...' : 'Submit'}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Teacher submissions list */}
                  {canManage && (
                    <div className="teacher-submissions">
                      <h4 className="mb-16" style={{ fontSize: '0.95rem' }}>
                        Submissions ({allSubs.length})
                      </h4>
                      {allSubs.length === 0 ? (
                        <p className="text-muted text-sm">No submissions yet.</p>
                      ) : allSubs.map(s => (
                        <div key={s.id} className="submission-row">
                          <div className="submission-row-header">
                            <div>
                              <p className="text-sm" style={{ fontWeight: 600 }}>
                                {s.group_members
                                  ? s.group_members.map(m => m.full_name).join(' & ')
                                  : (s.student?.full_name || 'Student')}
                              </p>
                              <p className="text-xs text-muted">
                                {s.submitted_at
                                  ? `Submitted ${new Date(s.submitted_at).toLocaleString()}`
                                  : 'Draft'}
                                {s.is_late && (
                                  <span className="badge badge-danger"
                                        style={{ marginLeft: 8, fontSize: '0.65rem' }}>Late</span>
                                )}
                                {s.flagged && (
                                  <span className="badge badge-warning"
                                        style={{ marginLeft: 8, fontSize: '0.65rem' }}>Flagged</span>
                                )}
                              </p>
                            </div>
                            <StatusBadge sub={s} />
                          </div>

                          {s.content && (
                            <div className="submission-content">
                              <p className="text-sm">{s.content}</p>
                            </div>
                          )}

                          {/* Contribution breakdown for group submissions */}
                          {s.group_id && contrib && contrib.members?.length > 0 && (
                            <div className="contrib-inline-block">
                              <p className="text-xs text-muted mb-8">Writing contribution</p>
                              {contrib.members.map((m, i) => (
                                <ContribRow
                                  key={m.user_id}
                                  member={m}
                                  total={contrib.members.reduce((acc, x) => acc + x.chars_written, 0)}
                                  color={COLORS[i % COLORS.length]}
                                />
                              ))}
                            </div>
                          )}

                          {s.status === 'submitted' && (
                            <div className="grade-form">
                              <div className="flex-center gap-12">
                                <input className="input" type="number"
                                  placeholder={`Score (max ${a.max_score})`} style={{ width: 140 }}
                                  value={gradeData[s.id]?.score || ''}
                                  onChange={e => setGradeData(prev => ({ ...prev,
                                    [s.id]: { ...prev[s.id], score: e.target.value } }))} />
                                <input className="input" placeholder="Feedback (optional)"
                                  value={gradeData[s.id]?.feedback || ''}
                                  onChange={e => setGradeData(prev => ({ ...prev,
                                    [s.id]: { ...prev[s.id], feedback: e.target.value } }))} />
                                <button className="btn btn-primary btn-sm"
                                  onClick={() => handleGrade(s.id, a.id)}>
                                  <Star size={14} /> Grade
                                </button>
                              </div>
                            </div>
                          )}
                          {s.status === 'graded' && (
                            <div className="grade-box" style={{ marginTop: 8 }}>
                              <p className="text-sm"><strong>Score:</strong> {s.score}/{a.max_score}</p>
                              {s.feedback && (
                                <p className="text-sm"><strong>Feedback:</strong> {s.feedback}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {assignments.length === 0 && (
          <div className="text-center text-muted" style={{ padding: 60 }}>
            <FileText size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>No assignments yet.{canManage && ' Click "New Assignment" to create one.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
