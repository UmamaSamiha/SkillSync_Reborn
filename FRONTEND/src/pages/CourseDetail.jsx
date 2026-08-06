import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, FileText, Star, Trash2, Clock, BookOpen,
  ExternalLink, Download, Upload, Link2, Paperclip, Plus, X,
  Map, Trophy, Lock, LockOpen, Zap, CheckCircle2, FileEdit, Award, Pencil,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import RoadmapStepModal from '../components/common/RoadmapStepModal';
import './Courses.css';
import './CourseDetail.css';

const OPEN_LIBRARY = 'https://openlibrary.org/search.json';
const CREDIT_COLORS = { 3: 'badge-info', 4: 'badge-success', 2: 'badge-warning' };

function StatusBadge({ status }) {
  if (status === 'pending_approval') return <span className="badge badge-warning"><Clock size={10} /> Pending Approval</span>;
  if (status === 'pending_deletion') return <span className="badge badge-danger"><Clock size={10} /> Pending Removal</span>;
  return null;
}

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
        {book.first_publish_year && <p className="book-year">{book.first_publish_year}</p>}
      </div>
    </div>
  );
}

function ResourceUploadForm({ courseId, onAdded, onCancel }) {
  const [mode, setMode]           = useState('link'); // 'link' | 'file'
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [url, setUrl]             = useState('');
  const [file, setFile]           = useState(null);
  const [saving, setSaving]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (mode === 'link' && !url.trim()) { toast.error('Add a link URL'); return; }
    if (mode === 'file' && !file) { toast.error('Choose a file to upload'); return; }

    setSaving(true);
    try {
      if (mode === 'file') {
        const formData = new FormData();
        formData.append('course_id', courseId);
        formData.append('title', title.trim());
        formData.append('description', description.trim());
        formData.append('file', file);
        await api.post('/resources', formData, { headers: { 'Content-Type': undefined } });
      } else {
        await api.post('/resources', {
          course_id: courseId,
          title: title.trim(),
          description: description.trim(),
          url: url.trim(),
          type: 'link',
        });
      }
      toast.success('Resource added');
      setTitle(''); setDesc(''); setUrl(''); setFile(null);
      onAdded();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add resource');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card resource-upload-form mb-16" onSubmit={handleSubmit}>
      <div className="flex-between mb-16">
        <h4 style={{ fontSize: '0.95rem' }}>Add Resource</h4>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}><X size={14} /></button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div onClick={() => setMode('link')} className={`type-toggle ${mode === 'link' ? 'active' : ''}`}>
          <Link2 size={14} /> Link
        </div>
        <div onClick={() => setMode('file')} className={`type-toggle ${mode === 'file' ? 'active' : ''}`}>
          <Paperclip size={14} /> File
        </div>
      </div>

      <div className="login-field mb-16">
        <label>Title *</label>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Week 3 slides" />
      </div>

      {mode === 'link' ? (
        <div className="login-field mb-16">
          <label>URL *</label>
          <input className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
        </div>
      ) : (
        <div className="login-field mb-16">
          <label>File *</label>
          <input className="input" type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>
      )}

      <div className="login-field" style={{ marginBottom: 16 }}>
        <label>Description</label>
        <textarea className="input" rows={2} value={description} onChange={e => setDesc(e.target.value)}
          placeholder="Optional notes for students" />
      </div>

      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
        <Upload size={14} /> {saving ? 'Uploading…' : 'Add Resource'}
      </button>
    </form>
  );
}

const STEP_STATUS = {
  locked:      { icon: Lock,        label: 'Locked' },
  unlocked:    { icon: LockOpen,    label: 'Submit work for teacher scoring' },
  in_progress: { icon: Zap,         label: 'Awaiting teacher score' },
  mastered:    { icon: CheckCircle2, label: 'Completed' },
};

function RoadmapStep({ topic, index, isLast, navigate }) {
  const st = STEP_STATUS[topic.user_status] || STEP_STATUS.locked;
  const done = topic.user_status === 'mastered';

  return (
    <div className="roadmap-step">
      <div className="roadmap-step-row">
        <div className={`roadmap-step-marker ${done ? 'done' : ''} ${topic.user_status === 'locked' ? 'is-locked' : ''}`}>
          {done ? <CheckCircle2 size={15} /> : topic.is_final_exam ? <Trophy size={14} /> : index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex-center gap-8" style={{ flexWrap: 'wrap' }}>
            <p className="text-sm" style={{ fontWeight: 600 }}>
              {topic.title}{topic.is_final_exam && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Final Exam</span>}
            </p>
          </div>
          {topic.description && <p className="text-xs text-muted mt-4">{topic.description}</p>}
          <span className={`badge roadmap-status-badge status-${topic.user_status}`}>
            <st.icon size={11} /> {st.label}
          </span>
          {topic.user_score != null && (
            <span className="text-xs text-muted" style={{ marginLeft: 8 }}>Best score: {topic.user_score}/100</span>
          )}
        </div>
        {(topic.user_status === 'unlocked' || topic.user_status === 'in_progress') && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/submit?topicId=${topic.id}&topicTitle=${encodeURIComponent(topic.title)}`)}
          >
            <FileEdit size={13} /> Submit Work
          </button>
        )}
      </div>
      {!isLast && <div className={`roadmap-connector ${done ? 'done' : ''}`} />}
    </div>
  );
}

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user, isTeacher, isAdmin } = useAuth();
  const canManage = isTeacher || isAdmin;

  const [course,    setCourse]    = useState(null);
  const [resources, setResources] = useState([]);
  const [books,      setBooks]    = useState([]);
  const [loading,    setLoading]  = useState(true);
  const [booksLoading, setBooksLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [topics,       setTopics]       = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [certificate,  setCertificate]  = useState(null);
  const [showAddStep,  setShowAddStep]  = useState(false);
  const [editStep,     setEditStep]     = useState(null);

  const isOwner = canManage && course?.instructor_id === user?.id;
  const canViewRoadmap = canManage || course?.enrolled;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/courses/${courseId}`),
      api.get(`/resources/course/${courseId}`).catch(() => ({ data: { data: [] } })),
    ])
      .then(([cRes, rRes]) => {
        setCourse(cRes.data?.data ?? null);
        setResources(rRes.data?.data ?? []);
      })
      .catch(() => toast.error('Failed to load course'))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const loadTopics = useCallback(() => {
    if (!courseId) return;
    setTopicsLoading(true);
    api.get('/curriculum/topics', { params: { course_id: courseId } })
      .then(res => setTopics(res.data?.data ?? []))
      .catch(() => setTopics([]))
      .finally(() => setTopicsLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (!course || !canViewRoadmap) { setTopics([]); return; }
    loadTopics();
  }, [course, canViewRoadmap, loadTopics]);

  useEffect(() => {
    if (!user?.id || canManage) { setCertificate(null); return; }
    api.get(`/certificates/user/${user.id}`)
      .then(res => setCertificate((res.data?.data || []).find(c => c.course_id === courseId) || null))
      .catch(() => {});
  }, [user?.id, courseId, canManage]);

  useEffect(() => {
    if (!course?.topic_keyword) return;
    setBooksLoading(true);
    fetch(`${OPEN_LIBRARY}?q=${encodeURIComponent(course.topic_keyword)}&limit=4&fields=title,author_name,cover_i,first_publish_year`)
      .then(res => res.json())
      .then(data => setBooks((data.docs || []).slice(0, 4)))
      .catch(() => {})
      .finally(() => setBooksLoading(false));
  }, [course?.topic_keyword]);

  const toggleEnroll = async () => {
    try {
      if (course.enrolled) {
        await api.delete(`/courses/${courseId}/enroll`);
        toast.success(`Unenrolled from ${course.code}`);
      } else {
        await api.post(`/courses/${courseId}/enroll`);
        toast.success(`Enrolled in ${course.code}!`);
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const handleRequestDelete = async () => {
    const confirmMsg = isAdmin
      ? `Remove ${course.code}? This takes it off the active catalog immediately.`
      : `Request removal of ${course.code}? An admin will need to approve it.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await api.delete(`/courses/${courseId}`);
      toast.success(res.data?.message || 'Done');
      navigate('/courses');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm('Delete this resource?')) return;
    try {
      await api.delete(`/resources/${resourceId}`);
      toast.success('Resource deleted');
      setResources(prev => prev.filter(r => r.id !== resourceId));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const handleOpenResource = (resource) => {
    if (resource.url) {
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    } else if (resource.file_path) {
      api.get(`/resources/${resource.id}/download`, { responseType: 'blob' })
        .then(res => {
          const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = resource.file_name || resource.title;
          a.click();
          window.URL.revokeObjectURL(blobUrl);
        })
        .catch(() => toast.error('Download failed'));
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading course...</div>;
  if (!course) return <div style={{ padding: 40 }}>Course not found.</div>;

  return (
    <div className="courses-page">
      <button className="btn btn-ghost btn-sm mb-16" onClick={() => navigate('/courses')}>
        <ArrowLeft size={14} /> Back to Courses
      </button>

      <div className="card mb-24">
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div className="flex-center gap-12" style={{ marginBottom: 8 }}>
              <span className="course-code">{course.code}</span>
              <StatusBadge status={course.status} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)' }}>{course.title}</h1>
            <p className="text-sm text-muted mt-4">
              {course.instructor && `Instructor: ${course.instructor}`}
            </p>
          </div>
          <div className="flex-center gap-12">
            <span className={`badge ${CREDIT_COLORS[course.credits] ?? 'badge-neutral'}`}>{course.credits} credits</span>
            <span className="flex-center gap-8 text-xs text-muted"><Users size={12} /> {course.student_count} students</span>
          </div>
        </div>

        {course.description && <p className="text-sm text-muted mt-16">{course.description}</p>}

        <div className="flex-center gap-12 mt-16" style={{ flexWrap: 'wrap' }}>
          {!canManage && (
            <>
              <button className={`btn btn-sm ${course.enrolled ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleEnroll}>
                {course.enrolled ? 'Unenroll' : 'Enroll'}
              </button>
              {course.enrolled && <span className="badge badge-success"><Star size={11} /> Enrolled</span>}
            </>
          )}
          {canManage && isOwner && (
            <>
              <span className="badge badge-success">Your Course</span>
              {course.status === 'active' && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={handleRequestDelete}>
                  <Trash2 size={13} /> Request Removal
                </button>
              )}
            </>
          )}
          {canManage && isAdmin && !isOwner && course.status === 'active' && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={handleRequestDelete}>
              <Trash2 size={13} /> Remove Course
            </button>
          )}
        </div>
      </div>

      {/* Roadmap */}
      {(showAddStep || editStep) && (
        <RoadmapStepModal
          courseId={courseId}
          existingTopics={topics}
          editTopic={editStep}
          onClose={() => { setShowAddStep(false); setEditStep(null); }}
          onSaved={loadTopics}
        />
      )}
      {canViewRoadmap && (
        <div className="card mb-24">
          <div className="flex-between mb-16">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
              <Map size={16} style={{ marginRight: 8, verticalAlign: -3 }} /> Roadmap
            </h3>
            {isOwner && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddStep(true)}>
                <Plus size={14} /> Add Step
              </button>
            )}
          </div>

          {certificate && (
            <div className="cert-earned-banner mb-16">
              <Award size={18} />
              <div style={{ flex: 1 }}>
                <p className="text-sm" style={{ fontWeight: 600 }}>Certificate earned!</p>
                <p className="text-xs text-muted">You've completed this course's roadmap and final exam.</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/certificates')}>View Certificate</button>
            </div>
          )}

          {topicsLoading ? (
            <p className="text-sm text-muted">Loading roadmap…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-muted">
              {isOwner ? 'No roadmap steps yet — click "Add Step" to build one for your students.' : 'No roadmap has been set up for this course yet.'}
            </p>
          ) : isOwner ? (
            <div className="flex-col gap-8">
              {[...topics].sort((a, b) => (a.is_final_exam - b.is_final_exam) || (a.order - b.order)).map(t => (
                <div key={t.id} className="roadmap-manage-row">
                  <div className="roadmap-step-marker">
                    {t.is_final_exam ? <Trophy size={14} /> : t.order}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-sm" style={{ fontWeight: 600 }}>
                      {t.title}{t.is_final_exam && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Final Exam</span>}
                    </p>
                    {t.description && <p className="text-xs text-muted truncate">{t.description}</p>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditStep(t)}>
                    <Pencil size={13} /> Edit
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="text-xs text-muted mb-16">
                {topics.filter(t => t.user_status === 'mastered').length} / {topics.length} steps complete
              </p>
              <div className="roadmap-steps">
                {topics.map((t, i) => (
                  <RoadmapStep key={t.id} topic={t} index={i} isLast={i === topics.length - 1} navigate={navigate} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {!canManage && !course.enrolled && (
        <div className="card mb-24">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', marginBottom: 8 }}>
            <Map size={16} style={{ marginRight: 8, verticalAlign: -3 }} /> Roadmap
          </h3>
          <p className="text-sm text-muted">Enroll in this course to see its roadmap and earn a certificate.</p>
        </div>
      )}

      {/* Resources */}
      <div className="card mb-24">
        <div className="flex-between mb-16">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
            <FileText size={16} style={{ marginRight: 8, verticalAlign: -3 }} /> Resources
          </h3>
          {isOwner && !showUpload && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowUpload(true)}>
              <Plus size={14} /> Add Resource
            </button>
          )}
        </div>

        {isOwner && showUpload && (
          <ResourceUploadForm
            courseId={courseId}
            onCancel={() => setShowUpload(false)}
            onAdded={() => { setShowUpload(false); load(); }}
          />
        )}

        {resources.length === 0 ? (
          <p className="text-sm text-muted">
            {isOwner ? 'No resources yet — add slides, links, or files for your students.' : 'No resources uploaded for this course yet.'}
          </p>
        ) : (
          <div className="flex-col gap-8">
            {resources.map(r => (
              <div key={r.id} className="resource-row" onClick={() => handleOpenResource(r)}>
                <div className="resource-row-icon">
                  {r.url ? <Link2 size={15} /> : <Paperclip size={15} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-sm" style={{ fontWeight: 600 }}>{r.title}</p>
                  {r.description && <p className="text-xs text-muted truncate">{r.description}</p>}
                  <p className="text-xs text-muted">Uploaded by {r.uploaded_by || 'Unknown'}</p>
                </div>
                {r.url
                  ? <ExternalLink size={14} className="text-muted" />
                  : <Download size={14} className="text-muted" />}
                {isOwner && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={e => { e.stopPropagation(); handleDeleteResource(r.id); }}
                  ><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Reading */}
      <div className="card recommended-books">
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', marginBottom: 4 }}>Recommended Reading</h3>
        <p className="text-xs text-muted mb-16">via Open Library</p>
        {booksLoading && <p className="text-sm text-muted">Fetching books...</p>}
        {!booksLoading && books.length > 0 && (
          <div className="books-grid">
            {books.map((b, i) => <BookCard key={i} book={b} />)}
          </div>
        )}
        {!booksLoading && books.length === 0 && (
          <p className="text-sm text-muted">No recommendations found.</p>
        )}
      </div>
    </div>
  );
}
