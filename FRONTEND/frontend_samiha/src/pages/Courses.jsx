import { useState, useEffect } from 'react';
import { BookOpen, Users, Star, ChevronDown, ChevronUp } from 'lucide-react';
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

function CourseCard({ course, onToggleEnroll }) {
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
      // silently fail — books are supplementary
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
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {expanded && (
        <div className="course-body">
          {course.description && (
            <p className="text-sm text-muted mb-16">{course.description}</p>
          )}

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
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = () => {
    api.get('/courses/')
      .then(res => setCourses(res.data?.data ?? []))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCourses(); }, []);

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
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>Courses</h1>
      <p className="text-muted text-sm mb-24">
        Browse available courses. Expand a course to see recommended books from Open Library.
      </p>

      {loading && <p className="text-muted">Loading courses...</p>}

      <div className="courses-list">
        {courses.map(c => (
          <CourseCard key={c.id} course={c} onToggleEnroll={toggleEnroll} />
        ))}
      </div>
    </div>
  );
}
