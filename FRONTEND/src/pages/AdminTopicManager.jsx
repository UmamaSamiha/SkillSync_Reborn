import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Trophy, Inbox } from 'lucide-react';
import RoadmapStepModal from '../components/common/RoadmapStepModal';

export default function AdminTopicManager() {
  const { isAdmin, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [courses,     setCourses]     = useState([]);
  const [courseId,    setCourseId]    = useState(searchParams.get('course_id') || '');
  const [topics,      setTopics]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);
  const [editTopic,   setEditTopic]   = useState(null);

  useEffect(() => {
    api.get('/courses').then(res => {
      const all = res.data?.data || [];
      setCourses(isAdmin ? all : all.filter(c => c.instructor_id === user?.id));
    }).catch(() => toast.error('Failed to load courses'));
  }, [isAdmin, user?.id]);

  const fetchTopics = useCallback(async () => {
    if (!courseId) { setTopics([]); return; }
    setLoading(true);
    try {
      const res = await api.get('/curriculum/topics', { params: { course_id: courseId } });
      setTopics(res.data.data || []);
    } catch {
      toast.error('Failed to load roadmap steps');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const handleSelectCourse = (id) => {
    setCourseId(id);
    setSearchParams(id ? { course_id: id } : {});
  };

  const sorted = [...topics].sort((a, b) => (a.is_final_exam - b.is_final_exam) || (a.order - b.order));

  return (
    <div>
      {(showCreate || editTopic) && (
        <RoadmapStepModal
          courseId={courseId}
          existingTopics={topics}
          editTopic={editTopic}
          onClose={() => { setShowCreate(false); setEditTopic(null); }}
          onSaved={fetchTopics}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Course Roadmap</h1>
          <p style={{ color: 'var(--color-muted)' }}>
            Build the steps students complete to finish a course, and mark one as the final exam.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={!courseId}
          style={{ fontSize: 14, padding: '10px 20px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Add Step
        </button>
      </div>

      {/* Course selector */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>
          Course
        </label>
        <select className="input" value={courseId} onChange={e => handleSelectCourse(e.target.value)}
          style={{ maxWidth: 420 }}>
          <option value="">Select a course…</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
          ))}
        </select>
      </div>

      {!courseId ? (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--color-muted)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 14,
        }}>
          <Inbox size={30} style={{ marginBottom: 12, opacity: 0.6 }} />
          <div style={{ fontWeight: 600 }}>Pick a course to manage its roadmap.</div>
        </div>
      ) : loading ? (
        <div style={{ padding: 40, color: 'var(--color-muted)' }}>Loading roadmap…</div>
      ) : sorted.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--color-muted)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 14,
        }}>
          <Inbox size={30} style={{ marginBottom: 12, opacity: 0.6 }} />
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No roadmap steps yet</div>
          <div style={{ fontSize: 13 }}>Click "Add Step" to create the first one.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(topic => (
            <div key={topic.id} style={{
              background: topic.is_final_exam ? 'rgba(245,158,11,.06)' : 'var(--color-surface)',
              border: `1px solid ${topic.is_final_exam ? 'var(--color-amber)' : 'var(--color-border)'}`,
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'var(--color-muted)',
              }}>
                {topic.is_final_exam ? <Trophy size={14} /> : topic.order}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{topic.title}</span>
                  {topic.is_final_exam && (
                    <span className="badge badge-warning">Final Exam</span>
                  )}
                  <span style={{
                    fontSize: 11, padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(99,102,241,.1)', color: 'var(--color-primary)',
                  }}>
                    Passing: {topic.mastery_threshold}%
                  </span>
                  {topic.prerequisite_ids?.length > 0 && (
                    <span style={{
                      fontSize: 11, padding: '1px 6px', borderRadius: 4,
                      background: 'var(--color-bg)', color: 'var(--color-muted)',
                      border: '1px solid var(--color-border)',
                    }}>
                      {topic.prerequisite_ids.length} prereq{topic.prerequisite_ids.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {topic.description && (
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 3 }}>
                    {topic.description}
                  </div>
                )}
              </div>

              <button className="btn" onClick={() => setEditTopic(topic)}
                style={{ fontSize: 12, padding: '6px 12px' }}>
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
