import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function EditTracker() {
  const [searchParams] = useSearchParams();
  const topicId        = searchParams.get('topicId');
  const topicTitle     = searchParams.get('topicTitle') || '';

  const [title,        setTitle]        = useState('');
  const [text,         setText]         = useState('');
  const [submissionId, setSubmissionId] = useState(null);
  const [pasteWarning, setPasteWarning] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [editCount,    setEditCount]    = useState(0);

  const prevTextRef = useRef('');
  const debounceRef = useRef(null);
  const isPasteRef  = useRef(false);

  const sendEdit = useCallback(async (currentText, wasPaste) => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/edits/track', {
        submission_id: submissionId,
        title:         title.trim(),
        content_type:  'assignment',
        topic_name:    topicTitle,
        topic_id:      topicId ? parseInt(topicId) : null,
        text:          currentText,
        prev_text:     prevTextRef.current,
        is_paste:      wasPaste,
      });
      const data = res.data.data;
      if (!submissionId) setSubmissionId(data.submission_id);
      setEditCount(c => c + 1);
      if (data.is_paste) setPasteWarning(true);
      prevTextRef.current = currentText;
    } catch {
      // silently ignore auto-save errors
    } finally {
      setSaving(false);
    }
  }, [submissionId, title, topicTitle, topicId]);

  const handleChange = (e) => {
    const newText  = e.target.value;
    const wasPaste = isPasteRef.current;
    isPasteRef.current = false;
    setText(newText);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      sendEdit(newText, wasPaste);
    }, 600);
  };

  const handlePaste = () => {
    isPasteRef.current = true;
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error('Please enter a title');
    if (!text.trim())  return toast.error('Please write your answer');
    setSubmitting(true);
    try {
      await api.post('/edits/track', {
        submission_id: submissionId,
        title:         title.trim(),
        content_type:  'assignment',
        topic_name:    topicTitle,
        topic_id:      topicId ? parseInt(topicId) : null,
        text:          text,
        prev_text:     prevTextRef.current,
        is_paste:      false,
      });
      setSubmitted(true);
      toast.success('Work submitted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNew = () => {
    setText('');
    setTitle('');
    setSubmissionId(null);
    setEditCount(0);
    setPasteWarning(false);
    setSubmitted(false);
    prevTextRef.current = '';
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Submitted!</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: 24 }}>
          Your work has been submitted. Your teacher will review and score it.
        </p>
        <button className="btn btn-primary" onClick={handleNew}>
          + Submit Another
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Submit Work</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 28 }}>
        Your edits are tracked in real time. Paste detection is active.
      </p>

      {/* Topic banner */}
      {topicTitle && (
        <div style={{
          background: 'rgba(99,102,241,.1)',
          border: '1px solid rgba(99,102,241,.3)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 20,
          fontSize: 13, color: 'var(--color-primary)', fontWeight: 600,
        }}>
          📚 Submitting for topic: {topicTitle}
        </div>
      )}

      {pasteWarning && (
        <div style={{
          background: 'rgba(239,68,68,.12)',
          border: '1px solid rgba(239,68,68,.4)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-red)', fontSize: 14 }}>
              Large paste detected
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              A sudden large addition was detected and flagged for review.
            </div>
          </div>
        </div>
      )}

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 24, maxWidth: 700,
      }}>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Title *
          </label>
          <input
            className="input"
            placeholder="e.g. My answer for Control Flow"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        {/* Answer */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Your Answer *
          </label>
          <textarea
            className="input"
            placeholder="Start typing your answer here..."
            value={text}
            onChange={handleChange}
            onPaste={handlePaste}
            rows={10}
            style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
          />
        </div>

        {/* Status bar + Submit */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', fontSize: 12, color: 'var(--color-muted)',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>{text.length} characters</span>
            <span>{editCount} edits tracked</span>
            {submissionId && (
              <span style={{ color: 'var(--color-green)' }}>
                ● {saving ? 'Saving…' : 'Auto-saved'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={handleNew}
              style={{
                fontSize: 12, padding: '6px 14px',
                background: 'var(--color-bg)',
                color: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
              }}>
              + New
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !text.trim()}
              style={{ fontSize: 13, padding: '8px 20px' }}
            >
              {submitting ? 'Submitting…' : '📤 Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}