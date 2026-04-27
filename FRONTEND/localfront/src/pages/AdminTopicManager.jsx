import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

const TRACKS = ['Python Basics', 'Control Flow', 'Functions', 'Data Structures', 'General'];

const EMPTY_FORM = {
  title: '',
  description: '',
  track: 'Python Basics',
  order: '',
  mastery_threshold: 70,
  prerequisite_ids: [],
};

function TopicFormModal({ existingTopics, editTopic, onClose, onSaved }) {
  const [form, setForm] = useState(editTopic ? {
    title: editTopic.title,
    description: editTopic.description || '',
    track: editTopic.track,
    order: editTopic.order,
    mastery_threshold: editTopic.mastery_threshold,
    prerequisite_ids: editTopic.prerequisite_ids || [],
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const togglePrereq = (id) => {
    set('prerequisite_ids', form.prerequisite_ids.includes(id)
      ? form.prerequisite_ids.filter(x => x !== id)
      : [...form.prerequisite_ids, id]
    );
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        order: parseInt(form.order) || 0,
        mastery_threshold: parseInt(form.mastery_threshold) || 70,
      };
      if (editTopic) {
        await api.put(`/curriculum/topics/${editTopic.id}`, payload);
        toast.success('Topic updated!');
      } else {
        await api.post('/curriculum/topics', payload);
        toast.success('Topic created!');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save topic');
    } finally {
      setSaving(false);
    }
  };

  const otherTopics = existingTopics.filter(t => t.id !== editTopic?.id);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 28, width: '90%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            {editTopic ? '✏️ Edit Topic' : '➕ New Topic'}
          </h2>
          <button className="btn" onClick={onClose}
            style={{ background: 'var(--color-border)', color: 'var(--color-muted)', padding: '6px 14px' }}>
            ✕ Close
          </button>
        </div>

        {/* Title */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>
            Title *
          </label>
          <input className="input" value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Variables & Data Types"
            style={{ width: '100%' }} />
        </div>

        {/* Description */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>
            Description
          </label>
          <textarea className="input" value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="What will students learn?"
            rows={3}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        {/* Track + Order row */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>
              Track
            </label>
            <select className="input" value={form.track}
              onChange={e => set('track', e.target.value)}
              style={{ width: '100%' }}>
              {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
            {form.track === '__custom__' && (
              <input className="input" placeholder="Enter track name"
                onChange={e => set('track', e.target.value)}
                style={{ width: '100%', marginTop: 8 }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>
              Order
            </label>
            <input className="input" type="number" min="0" value={form.order}
              onChange={e => set('order', e.target.value)}
              placeholder="0"
              style={{ width: '100%' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>
              Mastery %
            </label>
            <input className="input" type="number" min="1" max="100" value={form.mastery_threshold}
              onChange={e => set('mastery_threshold', e.target.value)}
              style={{ width: '100%' }} />
          </div>
        </div>

        {/* Prerequisites */}
        {otherTopics.length > 0 && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 8 }}>
              Prerequisites (optional)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
              {otherTopics.map(t => (
                <label key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  background: form.prerequisite_ids.includes(t.id)
                    ? 'rgba(99,102,241,.1)' : 'var(--color-bg)',
                  border: `1px solid ${form.prerequisite_ids.includes(t.id)
                    ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}>
                  <input type="checkbox"
                    checked={form.prerequisite_ids.includes(t.id)}
                    onChange={() => togglePrereq(t.id)} />
                  <span style={{ fontSize: 13 }}>{t.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 'auto' }}>
                    {t.track}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}
          style={{ fontSize: 14, padding: '10px 0', width: '100%' }}>
          {saving ? 'Saving…' : editTopic ? '💾 Save Changes' : '✅ Create Topic'}
        </button>
      </div>
    </div>
  );
}

export default function AdminTopicManager() {
  const [topics,      setTopics]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [editTopic,   setEditTopic]   = useState(null);
  const [search,      setSearch]      = useState('');
  const [filterTrack, setFilterTrack] = useState('All');

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/curriculum/topics');
      setTopics(res.data.data || []);
    } catch {
      toast.error('Failed to load topics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const tracks = ['All', ...Array.from(new Set(topics.map(t => t.track)))];

  const filtered = topics.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase());
    const matchTrack  = filterTrack === 'All' || t.track === filterTrack;
    return matchSearch && matchTrack;
  });

  const grouped = filtered.reduce((acc, t) => {
    (acc[t.track] = acc[t.track] || []).push(t);
    return acc;
  }, {});

  return (
    <div>
      {(showCreate || editTopic) && (
        <TopicFormModal
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
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Manage Topics</h1>
          <p style={{ color: 'var(--color-muted)' }}>
            Create and organise the curriculum. Students see topics based on their progress.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}
          style={{ fontSize: 14, padding: '10px 20px', flexShrink: 0 }}>
          ➕ Add New Topic
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Topics', value: topics.length, color: 'var(--color-primary)' },
          { label: 'Tracks',       value: tracks.length - 1, color: 'var(--color-amber)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, padding: '14px 20px', minWidth: 120,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input className="input" placeholder="🔍 Search topics…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tracks.map(t => (
            <button key={t} className="btn"
              onClick={() => setFilterTrack(t)}
              style={{
                fontSize: 12, padding: '6px 14px',
                background: filterTrack === t ? 'var(--color-primary)' : 'var(--color-surface)',
                color: filterTrack === t ? '#fff' : 'var(--color-muted)',
                border: filterTrack === t ? 'none' : '1px solid var(--color-border)',
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Topic list */}
      {loading ? (
        <div style={{ padding: 40, color: 'var(--color-muted)' }}>Loading topics…</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--color-muted)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 14,
        }}>
          {topics.length === 0
            ? <><div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No topics yet</div>
                <div style={{ fontSize: 13 }}>Click "Add New Topic" to get started.</div></>
            : <><div style={{ fontSize: 32, marginBottom: 12 }}>🔎</div>
                <div style={{ fontWeight: 600 }}>No topics match your search.</div></>
          }
        </div>
      ) : (
        Object.entries(grouped).map(([track, trackTopics]) => (
          <div key={track} style={{ marginBottom: 32 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{track}</h2>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: 'var(--color-surface)', color: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
              }}>
                {trackTopics.length} topic{trackTopics.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trackTopics.sort((a, b) => a.order - b.order).map(topic => (
                <div key={topic.id} style={{
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 12, padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  {/* Order badge */}
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'var(--color-muted)',
                  }}>
                    {topic.order}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{topic.title}</span>
                      <span style={{
                        fontSize: 11, padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(99,102,241,.1)', color: 'var(--color-primary)',
                      }}>
                        Mastery: {topic.mastery_threshold}%
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

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn" onClick={() => setEditTopic(topic)}
                      style={{ fontSize: 12, padding: '6px 12px' }}>
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}