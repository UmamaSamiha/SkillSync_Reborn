import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, X, Calendar, Users, Radio, Square } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './LiveClasses.css';

function statusBadge(status) {
  switch (status) {
    case 'live':      return <span className="badge badge-danger live-pulse"><Radio size={11} /> Live now</span>;
    case 'scheduled': return <span className="badge badge-info">Scheduled</span>;
    case 'ended':      return <span className="badge badge-neutral">Ended</span>;
    case 'canceled':   return <span className="badge badge-neutral">Canceled</span>;
    default:           return null;
  }
}

function ClassCard({ lc, canManage, onStart, onEnd, onCancel, onJoin, onViewAttendance }) {
  const when = lc.scheduled_at
    ? new Date(lc.scheduled_at).toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : '';

  return (
    <div className="card live-class-card">
      <div className="flex-between">
        <div>
          <div className="flex-center gap-8 mb-4">
            <span className="course-code">{lc.course_code}</span>
            {statusBadge(lc.status)}
          </div>
          <p className="live-class-title">{lc.title}</p>
          <p className="text-xs text-muted" style={{ marginTop: 2 }}>
            <Calendar size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
            {when} &middot; hosted by {lc.host_name}
          </p>
          {lc.description && <p className="text-sm text-muted mt-8">{lc.description}</p>}
        </div>
        {lc.status !== 'canceled' && (
          <span className="flex-center gap-8 text-xs text-muted">
            <Users size={12} /> {lc.attendee_count}
          </span>
        )}
      </div>

      <div className="flex-center gap-12 mt-16">
        {lc.status === 'scheduled' && (
          <button className="btn btn-primary btn-sm" onClick={() => (lc.is_host ? onStart(lc) : onJoin(lc))}>
            <Video size={14} /> {lc.is_host ? 'Start class' : 'Join'}
          </button>
        )}
        {lc.status === 'live' && (
          <button className="btn btn-primary btn-sm" onClick={() => onJoin(lc)}>
            <Video size={14} /> Join class
          </button>
        )}
        {lc.status === 'live' && lc.is_host && (
          <button className="btn btn-secondary btn-sm" onClick={() => onEnd(lc)}>
            <Square size={13} /> End class
          </button>
        )}
        {lc.status === 'scheduled' && lc.is_host && (
          <button className="btn btn-ghost btn-sm" onClick={() => onCancel(lc)}>
            <X size={14} /> Cancel
          </button>
        )}
        {canManage && lc.status === 'ended' && (
          <button className="btn btn-ghost btn-sm" onClick={() => onViewAttendance(lc)}>
            <Users size={14} /> Attendance
          </button>
        )}
      </div>
    </div>
  );
}

function AttendanceModal({ liveClass, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/live-classes/${liveClass.id}/attendance`)
      .then(res => setRows(res.data?.data ?? []))
      .catch(() => toast.error('Failed to load attendance'))
      .finally(() => setLoading(false));
  }, [liveClass.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-panel" onClick={e => e.stopPropagation()}>
        <div className="flex-between mb-16">
          <h3>{liveClass.title} — Attendance</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        {loading && <p className="text-muted text-sm">Loading...</p>}
        {!loading && rows.length === 0 && <p className="text-muted text-sm">No one joined this class.</p>}
        {!loading && rows.length > 0 && (
          <table className="attendance-table">
            <thead>
              <tr><th>Student</th><th>Joined</th><th>Duration</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.user_name}</td>
                  <td>{r.joined_at ? new Date(r.joined_at).toLocaleTimeString() : '—'}</td>
                  <td>{r.duration_minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function LiveClassesPage() {
  const { isTeacher, isAdmin } = useAuth();
  const canManage = isTeacher || isAdmin;
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [creating, setCreating] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState(null);
  const [form, setForm] = useState({ course_id: '', title: '', description: '', scheduled_at: '' });

  const fetchClasses = useCallback(() => {
    api.get('/live-classes/')
      .then(res => setClasses(res.data?.data ?? []))
      .catch(() => toast.error('Failed to load live classes'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchClasses();
    if (canManage) {
      api.get(isAdmin ? '/courses/' : '/courses/mine')
        .then(res => setCourses(res.data?.data ?? []))
        .catch(() => {});
    }
  }, [fetchClasses, canManage, isAdmin]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!form.course_id || !form.title || !form.scheduled_at) {
      toast.error('Course, title, and time are required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/live-classes/', {
        ...form,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
      });
      toast.success('Live class scheduled!');
      setForm({ course_id: '', title: '', description: '', scheduled_at: '' });
      setShowSchedule(false);
      fetchClasses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to schedule class');
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async (lc) => {
    try {
      await api.post(`/live-classes/${lc.id}/start`);
      navigate(`/live-classes/${lc.id}/room`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start class');
    }
  };

  const handleJoin = (lc) => navigate(`/live-classes/${lc.id}/room`);

  const handleEnd = async (lc) => {
    try {
      await api.post(`/live-classes/${lc.id}/end`);
      toast.success('Class ended');
      fetchClasses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to end class');
    }
  };

  const handleCancel = async (lc) => {
    try {
      await api.delete(`/live-classes/${lc.id}`);
      toast.success('Class canceled');
      fetchClasses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel class');
    }
  };

  const grouped = {
    live:      classes.filter(c => c.status === 'live'),
    scheduled: classes.filter(c => c.status === 'scheduled'),
    past:      classes.filter(c => c.status === 'ended' || c.status === 'canceled'),
  };

  return (
    <div className="live-classes-page">
      <div className="flex-between mb-4">
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Live Classes</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowSchedule(s => !s)}>
            {showSchedule ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Schedule Class</>}
          </button>
        )}
      </div>
      <p className="text-muted text-sm mb-24">
        Video classes over Jitsi Meet — no downloads, just join from the browser.
      </p>

      {showSchedule && canManage && (
        <form className="card create-form mb-24" onSubmit={handleSchedule}>
          <h3 style={{ marginBottom: 16 }}>Schedule a Live Class</h3>
          <div className="create-grid">
            <div className="login-field" style={{ gridColumn: 'span 2' }}>
              <label>Course *</label>
              <select className="input" value={form.course_id}
                onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))} required>
                <option value="">Select a course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
              </select>
            </div>
            <div className="login-field" style={{ gridColumn: 'span 2' }}>
              <label>Title *</label>
              <input className="input" placeholder="e.g. Week 6 Lecture: Recursion"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="login-field">
              <label>Date &amp; Time *</label>
              <input className="input" type="datetime-local"
                value={form.scheduled_at}
                onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} required />
            </div>
            <div className="login-field" style={{ gridColumn: 'span 2' }}>
              <label>Description</label>
              <textarea className="input" rows={2} placeholder="What will this session cover?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={creating}>
            <Plus size={16} /> {creating ? 'Scheduling...' : 'Schedule Class'}
          </button>
        </form>
      )}

      {loading && <p className="text-muted">Loading live classes...</p>}

      {!loading && classes.length === 0 && (
        <div className="text-center text-muted" style={{ padding: '60px 0' }}>
          <Video size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>{canManage ? 'No live classes yet. Schedule your first one!' : 'No live classes scheduled yet.'}</p>
        </div>
      )}

      {grouped.live.length > 0 && (
        <div className="mb-24">
          <h4 className="section-label">Live now</h4>
          <div className="live-classes-list">
            {grouped.live.map(lc => (
              <ClassCard key={lc.id} lc={lc} canManage={canManage}
                onStart={handleStart} onEnd={handleEnd} onCancel={handleCancel}
                onJoin={handleJoin} onViewAttendance={setAttendanceFor} />
            ))}
          </div>
        </div>
      )}

      {grouped.scheduled.length > 0 && (
        <div className="mb-24">
          <h4 className="section-label">Upcoming</h4>
          <div className="live-classes-list">
            {grouped.scheduled.map(lc => (
              <ClassCard key={lc.id} lc={lc} canManage={canManage}
                onStart={handleStart} onEnd={handleEnd} onCancel={handleCancel}
                onJoin={handleJoin} onViewAttendance={setAttendanceFor} />
            ))}
          </div>
        </div>
      )}

      {grouped.past.length > 0 && (
        <div className="mb-24">
          <h4 className="section-label">Past</h4>
          <div className="live-classes-list">
            {grouped.past.map(lc => (
              <ClassCard key={lc.id} lc={lc} canManage={canManage}
                onStart={handleStart} onEnd={handleEnd} onCancel={handleCancel}
                onJoin={handleJoin} onViewAttendance={setAttendanceFor} />
            ))}
          </div>
        </div>
      )}

      {attendanceFor && (
        <AttendanceModal liveClass={attendanceFor} onClose={() => setAttendanceFor(null)} />
      )}
    </div>
  );
}
