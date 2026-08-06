import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, ChevronRight, ChevronDown, ChevronUp,
  Send, Plus, X, AlertCircle, Users, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import DocEditor from '../components/common/DocEditor';
import './Assignments.css';

/* ── Small helpers ──────────────────────────────────────── */
function StatusBadge({ sub }) {
  if (!sub)                       return <span className="badge badge-neutral">Not started</span>;
  if (sub.status === 'graded')    return <span className="badge badge-success">Graded: {sub.score}</span>;
  if (sub.status === 'submitted') return <span className="badge badge-info">Submitted</span>;
  return <span className="badge badge-warning">Draft</span>;
}

/* ══════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════ */
export default function AssignmentsPage() {
  const { isTeacher, isAdmin } = useAuth();
  const canManage = isTeacher || isAdmin;
  const navigate = useNavigate();

  const [assignments,    setAssignments]    = useState([]);
  const [courses,        setCourses]        = useState([]);
  const [courseFilter,   setCourseFilter]   = useState('');
  const [loading,        setLoading]        = useState(true);
  const [expanded,       setExpanded]       = useState(null);
  const [submissions,    setSubmissions]    = useState({});
  const [content,        setContent]        = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [showCreate,     setShowCreate]     = useState(false);
  const [allStudents,    setAllStudents]     = useState([]);
  const [pickedStudents, setPickedStudents] = useState([]);
  const [courseProjects, setCourseProjects] = useState([]);

  const [form, setForm] = useState({
    course_id:   '',
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

  useEffect(() => {
    fetchAssignments();

    // Teachers see their own courses; students see only enrolled courses
    const courseEndpoint = canManage ? '/courses/mine' : '/courses/';
    api.get(courseEndpoint)
      .then(res => {
        const all = res.data?.data ?? [];
        // For students, only show courses they're enrolled in
        const filtered = canManage ? all : all.filter(c => c.enrolled);
        setCourses(filtered);
      })
      .catch(() => {});

    if (canManage) {
      api.get('/courses/mine/students')
        .then(r => setAllStudents(r.data?.data ?? []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCourseChange = async (e) => {
    const courseId = e.target.value;
    setForm(f => ({ ...f, course_id: courseId, project_id: '' }));
    setCourseProjects([]);
    if (!courseId) return;
    try {
      const res      = await api.get(`/courses/${courseId}/projects`);
      const projects = res.data?.data ?? [];
      setCourseProjects(projects);
      if (projects.length > 0) {
        setForm(f => ({ ...f, project_id: projects[0].id }));
      }
    } catch {}
  };

  /* Students expand in place to submit; teachers navigate to a dedicated page. */
  const handleCardClick = async (a) => {
    if (canManage) {
      navigate(`/assignments/${a.id}`);
      return;
    }

    if (expanded === a.id) { setExpanded(null); return; }
    setExpanded(a.id);
    setContent('');

    try {
      const res   = await api.get(`/assignments/${a.id}/submissions`);
      const items = res.data.data.items || [];
      if (items.length > 0) {
        setSubmissions(prev => ({ ...prev, [a.id]: items[0] }));
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
    if (!form.project_id) { toast.error('Select a course with a linked project.'); return; }
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
      setCourseProjects([]);
      setForm({ course_id: '', project_id: '', title: '', description: '', due_date: '', max_score: '100', difficulty: 'intermediate', is_group: false });
      await fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create');
    }
  };

  // Filter assignments by selected course
  const visibleAssignments = courseFilter
    ? assignments.filter(a => a.course_id === courseFilter)
    : assignments;

  if (loading) return <div style={{ padding: 40 }}>Loading assignments...</div>;

  return (
    <div className="assignments-page">
      <div className="flex-between mb-16">
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Assignments</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Assignment</>}
          </button>
        )}
      </div>

      {/* ── Course Filter Bar ─────────────────────────────── */}
      {courses.length > 0 && (
        <div className="flex-center gap-12 mb-24" style={{ flexWrap: 'wrap' }}>
          <BookOpen size={14} className="text-muted" />
          <button
            className={`btn btn-sm ${courseFilter === '' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setCourseFilter('')}
          >
            All Courses
          </button>
          {courses.map(c => (
            <button
              key={c.id}
              className={`btn btn-sm ${courseFilter === c.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCourseFilter(c.id)}
            >
              {c.code}
            </button>
          ))}
        </div>
      )}

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

          {/* Course selector */}
          <div className="login-field mb-16">
            <label>Course *</label>
            <select
              className="input"
              value={form.course_id}
              onChange={handleCourseChange}
              required
            >
              <option value="">Select a course</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
            {form.course_id && courseProjects.length === 0 && (
              <div className="info-banner mt-8">
                <AlertCircle size={16} />
                <span>No project linked to this course yet. Contact admin to create one.</span>
              </div>
            )}
            {form.course_id && courseProjects.length > 0 && (
              <p className="text-xs text-muted mt-4">
                Project: {courseProjects.find(p => p.id === form.project_id)?.name ?? '—'}
              </p>
            )}
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
                min={new Date().toISOString().slice(0, 16)}
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

          <div className="login-field" style={{ marginTop: 12 }}>
            <label>Description</label>
            <textarea className="input" rows={3} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Assignment instructions..." />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}
            disabled={!form.project_id || (form.is_group && pickedStudents.length < 2)}>
            <Plus size={16} /> {form.is_group
              ? `Create Group Assignment${pickedStudents.length >= 2 ? ` (${pickedStudents.length} members)` : ' — select members above'}`
              : 'Create Assignment'}
          </button>
        </form>
      )}

      {/* ── Assignment List ───────────────────────────── */}
      <div className="assignments-list">
        {visibleAssignments.map(a => {
          const isExp     = !canManage && expanded === a.id;
          const sub       = !canManage ? submissions[a.id] : null;
          const isOverdue = a.due_date && new Date(a.due_date) < new Date();

          return (
            <div key={a.id} className={`assignment-card card ${isExp ? 'expanded' : ''}`}>
              <div className="assignment-header" onClick={() => handleCardClick(a)}>
                <div className="flex-center gap-12">
                  <FileText size={18} className="text-primary" />
                  <div>
                    <p className="assignment-title">{a.title}</p>
                    <div className="flex-center gap-8" style={{ marginTop: 2 }}>
                      {a.course_code && (
                        <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                          <BookOpen size={9} style={{ marginRight: 2 }} />
                          {a.course_code}
                        </span>
                      )}
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
                      {canManage && (a.pending_count ?? 0) > 0 && (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                          {a.pending_count} to grade
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-center gap-12">
                  {!canManage && <StatusBadge sub={sub} />}
                  {canManage ? <ChevronRight size={16} className="text-muted" /> : (isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
                </div>
              </div>

              {/* Student submission area (teachers navigate away instead of expanding) */}
              {isExp && (
                <div className="assignment-body">
                  {a.description && <p className="text-sm text-muted mb-16">{a.description}</p>}

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
                      <DocEditor
                        key={a.id}
                        content={content}
                        onChange={setContent}
                        placeholder="Type your answer here..."
                      />
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
                </div>
              )}
            </div>
          );
        })}

        {visibleAssignments.length === 0 && (
          <div className="text-center text-muted" style={{ padding: 60 }}>
            <FileText size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>
              {courseFilter
                ? 'No assignments in this course yet.'
                : `No assignments yet.${canManage ? ' Click "New Assignment" to create one.' : ''}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
