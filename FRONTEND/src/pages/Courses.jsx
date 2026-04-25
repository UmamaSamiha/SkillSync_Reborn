import { useState, useEffect } from 'react';
import { BookOpen, Users, Star, ChevronDown, ChevronUp, FileText, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Courses.css';

const OPEN_LIBRARY = 'https://openlibrary.org/search.json';

function BookCard({ book }) {
  const cover = book.cover_i
    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
    : null;
  return (
    <div className="book-card">
      {cover
        ? <img src={cover} alt={book.title} className="book-cover" />
        : <div className="book-cover-placeholder"><BookOpen size={28} /></div>
      }
      <div className="book-info">
        <p className="book-title">{book.title}</p>
        <p className="book-author">{(book.author_name || []).slice(0, 2).join(', ')}</p>
        {book.first_publish_year && (
          <p className="book-year">{book.first_publish_year}</p>
        )}
      </div>
    </div>
  );
}

function CourseCard({ course, onToggleEnroll, canManage }) {
  const [books,    setBooks]    = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const fetchBooks = async () => {
    if (books.length || !course.topic_keyword) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${OPEN_LIBRARY}?q=${encodeURIComponent(course.topic_keyword)}&limit=4&fields=title,author_name,cover_i,first_publish_year`
      );
      const data = await res.json();
      setBooks((data.docs || []).slice(0, 4));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = () => {
    setExpanded(e => !e);
    if (!expanded) fetchBooks();
  };

  const CREDIT_COLORS = { 3: 'badge-info', 4: 'badge-success', 2: 'badge-warning' };

  return (
    <div className={`course-card card ${expanded ? 'expanded' : ''}`}>
      <div className="course-header" onClick={handleExpand}>
        <div className="course-header-left">
          <span className="course-code">{course.code}</span>
          <div>
            <p className="course-title">{course.title}</p>
            <p className="text-xs text-muted" style={{ marginTop: 2 }}>
              {course.instructor && `Instructor: ${course.instructor}`}
            </p>
          </div>
        </div>
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
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {expanded && (
        <div className="course-body">
          {course.description && (
            <p className="text-sm text-muted mb-16">{course.description}</p>
          )}

          {/* Students see enroll button; teachers see their own course */}
          {!canManage && (
            <div className="flex-center gap-12 mb-16">
              <button
                className={`btn btn-sm ${course.enrolled ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => onToggleEnroll(course)}
              >
                {course.enrolled ? 'Unenroll' : 'Enroll'}
              </button>
              {course.enrolled && (
                <span className="badge badge-success"><Star size={11} /> Enrolled</span>
              )}
            </div>
          )}

          {canManage && (
            <div className="flex-center gap-12 mb-16">
              <span className="badge badge-success">Your Course</span>
              <span className="text-xs text-muted">{course.student_count} students enrolled</span>
            </div>
          )}

          <div className="recommended-books">
            <h4 className="mb-16" style={{ fontSize: '0.9rem' }}>
              Recommended Reading
              <span className="text-xs text-muted" style={{ marginLeft: 8, fontWeight: 400 }}>
                via Open Library
              </span>
            </h4>
            {loading && <p className="text-sm text-muted">Fetching books...</p>}
            {!loading && books.length > 0 && (
              <div className="books-grid">
                {books.map((b, i) => <BookCard key={i} book={b} />)}
              </div>
            )}
            {!loading && books.length === 0 && (
              <p className="text-sm text-muted">No recommendations found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoursesPage() {
  const { isTeacher, isAdmin } = useAuth();
  const canManage = isTeacher || isAdmin;

  const [courses,    setCourses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
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
      await api.post('/courses/', {
        code:          form.code.toUpperCase().trim(),
        title:         form.title.trim(),
        description:   form.description.trim(),
        credits:       parseInt(form.credits) || 3,
        topic_keyword: form.topic_keyword.trim(),
      });
      toast.success(`Course ${form.code.toUpperCase()} created!`);
      setForm({ code: '', title: '', description: '', credits: '3', topic_keyword: '' });
      setShowCreate(false);
      fetchCourses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create course');
    } finally {
      setCreating(false);
    }
  };

  const toggleEnroll = async (course) => {
    try {
      if (course.enrolled) {
        await api.delete(`/courses/${course.id}/enroll`);
        toast.success(`Unenrolled from ${course.code}`);
      } else {
        await api.post(`/courses/${course.id}/enroll`);
        toast.success(`Enrolled in ${course.code}!`);
      }
      fetchCourses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

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
          : 'Browse and enroll in available courses.'}
      </p>

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

      {!loading && courses.length === 0 && (
        <div className="text-center text-muted" style={{ padding: '60px 0' }}>
          <BookOpen size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>{canManage ? 'No courses yet. Create your first one!' : 'No courses available yet.'}</p>
        </div>
      )}

      <div className="courses-list">
        {courses.map(c => (
          <CourseCard key={c.id} course={c} onToggleEnroll={toggleEnroll} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}
