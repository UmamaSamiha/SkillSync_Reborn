import { useState } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Save, CheckCircle2, Trophy } from 'lucide-react';

const EMPTY_FORM = {
  title: '',
  description: '',
  order: '',
  mastery_threshold: 70,
  is_final_exam: false,
  prerequisite_ids: [],
};

export default function RoadmapStepModal({ courseId, existingTopics, editTopic, onClose, onSaved }) {
  const [form, setForm] = useState(editTopic ? {
    title: editTopic.title,
    description: editTopic.description || '',
    order: editTopic.order,
    mastery_threshold: editTopic.mastery_threshold,
    is_final_exam: editTopic.is_final_exam || false,
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
        course_id: courseId,
        order: parseInt(form.order) || 0,
        mastery_threshold: parseInt(form.mastery_threshold) || 70,
      };
      if (editTopic) {
        await api.put(`/curriculum/topics/${editTopic.id}`, payload);
        toast.success('Roadmap step updated!');
      } else {
        await api.post('/curriculum/topics', payload);
        toast.success('Roadmap step created!');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save roadmap step');
    } finally {
      setSaving(false);
    }
  };

  const otherTopics = existingTopics.filter(t => t.id !== editTopic?.id && !t.is_final_exam);

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
            {editTopic ? 'Edit Roadmap Step' : 'New Roadmap Step'}
          </h2>
          <button className="btn" onClick={onClose}
            style={{ background: 'var(--color-border)', color: 'var(--color-muted)', padding: '6px 14px' }}>
            Close
          </button>
        </div>

        {/* Title */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>
            Title *
          </label>
          <input className="input" value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Arrays & Linked Lists"
            style={{ width: '100%' }} />
        </div>

        {/* Description */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>
            Description
          </label>
          <textarea className="input" value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="What should students do for this step?"
            rows={3}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        {/* Order + Mastery row */}
        <div style={{ display: 'flex', gap: 12 }}>
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
              Passing score %
            </label>
            <input className="input" type="number" min="1" max="100" value={form.mastery_threshold}
              onChange={e => set('mastery_threshold', e.target.value)}
              style={{ width: '100%' }} />
          </div>
        </div>

        {/* Final exam toggle */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderRadius: 8, cursor: 'pointer',
          background: form.is_final_exam ? 'rgba(245,158,11,.1)' : 'var(--color-bg)',
          border: `1px solid ${form.is_final_exam ? 'var(--color-amber)' : 'var(--color-border)'}`,
        }}>
          <input type="checkbox" checked={form.is_final_exam}
            onChange={e => set('is_final_exam', e.target.checked)} />
          <Trophy size={14} />
          <span style={{ fontSize: 13 }}>This is the Final Exam for this course</span>
        </label>
        {form.is_final_exam && (
          <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Unlocks automatically once every other step in this course is completed. Passing it
            issues the student's certificate for this course.
          </p>
        )}

        {/* Prerequisites */}
        {!form.is_final_exam && otherTopics.length > 0 && (
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
                </label>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}
          style={{ fontSize: 14, padding: '10px 0', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving
            ? 'Saving…'
            : editTopic ? <><Save size={15} /> Save Changes</> : <><CheckCircle2 size={15} /> Create Step</>}
        </button>
      </div>
    </div>
  );
}
