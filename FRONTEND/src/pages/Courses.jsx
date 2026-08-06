import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Star, FileText, Plus, X, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Courses.css';

function StatusBadge({ status }) {
  if (status === 'pending_approval') return <span className="badge badge-warning"><Clock size={10} /> Pending Approval</span>;
  if (status === 'pending_deletion') return <span className="badge badge-danger"><Clock size={10} /> Pending Removal</span>;
  return null;
}

const CREDIT_COLORS = { 3: 'badge-info', 4: 'badge-success', 2: 'badge-warning' };

function CourseBlock({ course, canManage, isOwner, onClick }) {
  return (
    <div className="course-block card" onClick={onClick}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <span className="course-code">{course.code}</span>
        <StatusBadge status={course.status} />
      </div>

      <p className="course-block-title">{course.title}</p>
      <p className="text-xs text-muted course-block-instructor">
        {course.instructor && `Instructor: ${course.instructor}`}
      </p>

      {course.description && (
        <p className="text-sm text-muted course-block-desc">{course.description}</p>
      )}

      <div className="course-block-footer">
        <div className="flex-center gap-12">
          <span className={`badge ${CREDIT_COLORS[course.credits] ?? 'badge-neutral'}`}>
            {course.credits} credits
          </span>
          <span className="flex-center gap-8 text-xs text-muted">
            <Users size={12} /> {course.student_count}
          </span>
          <span className="flex-center gap-8 text-xs text-muted">
            <FileText size={12} /> {course.assignment_count ?? 0}
          </span>
        </div>
        <ChevronRight size={16} className="text-muted" />
      </div>

      <div className="flex-center gap-8 course-block-tags">
        {canManage && isOwner && <span className="badge badge-success">Your Course</span>}
        {!canManage && course.enrolled && (
          <span className="badge badge-success"><Star size={11} /> Enrolled</span>
        )}
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const { user, isTeacher, isAdmin } = useAuth();
  const navigate = useNavigate();
  const canManage = isTeacher || isAdmin;

  const [courses,    setCourses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode,   setViewMode]   = useState('my'); // 'my' | 'available' — students only
  const [form, setForm] = useState({
    code: '', title: '', description: '', credits: '3', topic_keyword: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchCourses = () => {
    api.get('/courses/')
      .then(res => setCourses(res.data?.data ?? []))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.code || !form.title) { toast.error('Code and title are required'); return; }
    setCreating(true);
    try {
      const res = await api.post('/courses/', {
        code:          form.code.toUpperCase().trim(),
        title:         form.title.trim(),
        description:   form.description.trim(),
        credits:       parseInt(form.credits) || 3,
        topic_keyword: form.topic_keyword.trim(),
      });
      toast.success(res.data?.message || `Course ${form.code.toUpperCase()} created!`);
      setForm({ code: '', title: '', description: '', credits: '3', topic_keyword: '' });
      setShowCreate(false);
      fetchCourses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create course');
    } finally {
      setCreating(false);
    }
  };

  // Students: "My Courses" = enrolled only, "Available Courses" = everything.
  // Teachers/admins are unaffected — they always see their full manageable list.
  const visibleCourses = canManage
    ? courses
    : viewMode === 'my'
    ? courses.filter(c => c.enrolled)
    : courses;

  return (
    <div className="courses-page">
      <div className="flex-between mb-4">
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Courses</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreate(s => !s)}>
            {showCreate ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Course</>}
          </button>
        )}
      </div>
      <p className="text-muted text-sm mb-24">
        {canManage
          ? 'Manage your courses. Each course gets a linked project for assignments.'
          : 'Browse your enrolled courses, or find new ones to join.'}
      </p>

      {/* My Courses / Available Courses — students only */}
      {!canManage && (
        <div className="flex-center gap-8 mb-24">
          <button
            className={`btn btn-sm ${viewMode === 'my' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('my')}
          >
            My Courses
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'available' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('available')}
          >
            Available Courses
          </button>
        </div>
      )}

      {/* Create Course Form — teachers only */}
      {showCreate && canManage && (
        <form className="card create-form mb-24" onSubmit={handleCreate}>
          <h3 style={{ marginBottom: 16 }}>Create New Course</h3>
          <div className="create-grid">
            <div className="login-field">
              <label>Course Code *</label>
              <input className="input" placeholder="e.g. CS101"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                required />
            </div>
            <div className="login-field">
              <label>Credits</label>
              <select className="input" value={form.credits}
                onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>
            <div className="login-field" style={{ gridColumn: 'span 2' }}>
              <label>Title *</label>
              <input className="input" placeholder="e.g. Introduction to Computer Science"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required />
            </div>
            <div className="login-field" style={{ gridColumn: 'span 2' }}>
              <label>Topic Keyword <span className="text-muted">(for book recommendations)</span></label>
              <input className="input" placeholder="e.g. machine learning"
                value={form.topic_keyword}
                onChange={e => setForm(f => ({ ...f, topic_keyword: e.target.value }))} />
            </div>
            <div className="login-field" style={{ gridColumn: 'span 2' }}>
              <label>Description</label>
              <textarea className="input" rows={2} placeholder="What will students learn?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}
            disabled={creating}>
            <Plus size={16} /> {creating ? 'Creating...' : 'Create Course'}
          </button>
        </form>
      )}

      {loading && <p className="text-muted">Loading courses...</p>}

      {!loading && visibleCourses.length === 0 && (
        <div className="text-center text-muted" style={{ padding: '60px 0' }}>
          <BookOpen size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>
            {canManage
              ? 'No courses yet. Create your first one!'
              : viewMode === 'my'
              ? "You haven't enrolled in any courses yet — check Available Courses."
              : 'No courses available yet.'}
          </p>
        </div>
      )}

      <div className="courses-blocks">
        {visibleCourses.map(c => (
          <CourseBlock
            key={c.id}
            course={c}
            canManage={canManage}
            isOwner={c.instructor_id === user?.id}
            onClick={() => navigate(`/courses/${c.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
