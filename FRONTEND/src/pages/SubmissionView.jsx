import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, ScanLine, Bot, Repeat2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import DocEditor from '../components/common/DocEditor';

function ContribRow({ member, total, color }) {
  const pct = total > 0 ? Math.round(member.chars_written / total * 100) : 0;
  return (
    <div className="contrib-inline-row">
      <span className="contrib-inline-name">{member.full_name}</span>
      <div className="progress-bar" style={{ flex: 1 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-muted" style={{ minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

const COLORS = ['#893941', '#5E6623', '#4A6B8A', '#C17B3A', '#7B5EA7'];

export default function SubmissionViewPage() {
  const { assignmentId, submissionId } = useParams();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [contrib,    setContrib]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [scanning,   setScanning]   = useState(false);
  const [gradeScore,    setGradeScore]    = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [memberGrades,  setMemberGrades]  = useState({});
  const [saving,     setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        api.get(`/assignments/${assignmentId}`),
        api.get(`/assignments/${assignmentId}/submissions?per_page=100`),
      ]);
      const a = aRes.data?.data ?? null;
      const found = (sRes.data?.data?.items ?? []).find(s => s.id === submissionId);
      setAssignment(a);
      setSubmission(found ?? null);

      if (found?.group_id) {
        api.get(`/timelogs/assignment/${assignmentId}/contributions`)
          .then(r => setContrib(r.data?.data))
          .catch(() => {});
      }
    } catch {
      toast.error('Failed to load submission');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, submissionId]);

  useEffect(() => { load(); }, [load]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res  = await api.post(`/ai/scan/${submissionId}`);
      const data = res.data?.data ?? {};
      setSubmission(prev => ({ ...prev, ai_score: data.ai_score, similarity_score: data.similarity_score, flagged: data.flagged, scan_reason: data.reason }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleGrade = async () => {
    if (gradeScore === '') { toast.error('Enter a score'); return; }
    const score = parseFloat(gradeScore);
    if (isNaN(score) || score < 0) { toast.error('Score must be a valid number ≥ 0'); return; }
    if (assignment && score > assignment.max_score) { toast.error(`Score cannot exceed ${assignment.max_score}`); return; }
    setSaving(true);
    try {
      await api.put(`/assignments/submissions/${submissionId}/grade`, { score, feedback: gradeFeedback });
      toast.success('Graded — student notified.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Grading failed');
    } finally {
      setSaving(false);
    }
  };

  const handleMemberGrade = async () => {
    const groupMembers = submission.group_members || [];
    const grades = groupMembers.map(m => ({
      student_id: m.user_id,
      score:      parseFloat(memberGrades[m.user_id]?.score ?? ''),
      feedback:   memberGrades[m.user_id]?.feedback || '',
    }));
    if (grades.some(g => isNaN(g.score) || g.score < 0)) { toast.error('Enter valid scores (≥ 0) for every member'); return; }
    if (assignment && grades.some(g => g.score > assignment.max_score)) { toast.error(`All scores must be ≤ ${assignment.max_score}`); return; }
    setSaving(true);
    try {
      await api.post(`/assignments/submissions/${submissionId}/member-grades`, { member_grades: grades });
      toast.success('Individual grades saved — each member notified.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Grading failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading submission...</div>;
  if (!assignment || !submission) return <div style={{ padding: 40 }}>Submission not found.</div>;

  const name = submission.group_members
    ? submission.group_members.map(m => m.full_name).join(' & ')
    : (submission.student?.full_name || 'Student');

  return (
    <div className="assignments-page">
      <button className="btn btn-ghost btn-sm mb-16" onClick={() => navigate(`/assignments/${assignmentId}`)}>
        <ArrowLeft size={14} /> Back to {assignment.title}
      </button>

      <div className="card mb-24">
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>{name}</h1>
            <p className="text-xs text-muted">
              {submission.submitted_at ? `Submitted ${new Date(submission.submitted_at).toLocaleString()}` : 'Draft — not yet submitted'}
              {submission.is_late && <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: '0.65rem' }}>Late</span>}
            </p>
          </div>
          <span className={`badge ${submission.status === 'graded' ? 'badge-success' : submission.status === 'submitted' ? 'badge-info' : 'badge-warning'}`}>
            {submission.status}
          </span>
        </div>

        {/* AI / Plagiarism check — merged into the assignment view */}
        <div className="mt-16" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          {submission.ai_score !== undefined && submission.ai_score !== null ? (
            <div className="flex-center gap-12" style={{ flexWrap: 'wrap' }}>
              <span className={`badge ${submission.ai_score > 60 ? 'badge-danger' : 'badge-success'}`}>
                <Bot size={11} /> AI likelihood: {submission.ai_score}%
              </span>
              {submission.similarity_score > 0 && (
                <span className={`badge ${submission.similarity_score > 50 ? 'badge-warning' : 'badge-neutral'}`}>
                  <Repeat2 size={11} /> Similarity: {submission.similarity_score}%
                </span>
              )}
              {submission.scan_reason && <span className="text-xs text-muted" style={{ fontStyle: 'italic' }}>{submission.scan_reason}</span>}
              <button className="btn btn-ghost btn-sm" onClick={handleScan} disabled={scanning}>
                <ScanLine size={13} /> {scanning ? 'Re-scanning…' : 'Re-scan'}
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={handleScan} disabled={scanning || !submission.content}>
              <ScanLine size={13} /> {scanning ? 'Scanning…' : 'Check AI & Plagiarism'}
            </button>
          )}
        </div>
      </div>

      {/* Contribution breakdown for group submissions */}
      {submission.group_id && contrib && contrib.members?.length > 0 && (
        <div className="card mb-24">
          <p className="text-xs text-muted mb-8" style={{ fontWeight: 600 }}>Writing contribution</p>
          {contrib.members.map((m, i) => (
            <ContribRow key={m.user_id} member={m} total={contrib.members.reduce((acc, x) => acc + x.chars_written, 0)} color={COLORS[i % COLORS.length]} />
          ))}
        </div>
      )}

      {/* The submission content, rendered like a Word document */}
      <div className="card mb-24">
        <p className="text-xs text-muted mb-8" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Submission</p>
        {submission.content
          ? <DocEditor content={submission.content} editable={false} />
          : <p className="text-sm text-muted">No content submitted.</p>}
      </div>

      {/* Grading */}
      {submission.status === 'graded' ? (
        <div className="card grade-box">
          <p><strong>Score:</strong> {submission.score} / {assignment.max_score}</p>
          {submission.feedback && <p><strong>Feedback:</strong> {submission.feedback}</p>}
        </div>
      ) : submission.status === 'submitted' && submission.group_members?.length > 0 ? (
        <div className="card">
          <p className="text-sm mb-16" style={{ fontWeight: 600 }}>Grade each member individually</p>
          {submission.group_members.map(m => (
            <div key={m.user_id} className="flex-center gap-12 mb-8">
              <span className="text-sm" style={{ minWidth: 130, fontWeight: 500 }}>{m.full_name}</span>
              <input className="input" type="number" placeholder={`Score (max ${assignment.max_score})`} style={{ width: 140 }}
                min="0" max={assignment.max_score}
                value={memberGrades[m.user_id]?.score || ''}
                onChange={e => setMemberGrades(prev => ({ ...prev, [m.user_id]: { ...prev[m.user_id], score: e.target.value } }))} />
              <input className="input" placeholder="Feedback"
                value={memberGrades[m.user_id]?.feedback || ''}
                onChange={e => setMemberGrades(prev => ({ ...prev, [m.user_id]: { ...prev[m.user_id], feedback: e.target.value } }))} />
            </div>
          ))}
          <button className="btn btn-primary btn-sm mt-8" onClick={handleMemberGrade} disabled={saving}>
            <Star size={14} /> {saving ? 'Saving…' : 'Save All Grades'}
          </button>
        </div>
      ) : submission.status === 'submitted' ? (
        <div className="card">
          <p className="text-sm mb-16" style={{ fontWeight: 600 }}>Grade this submission</p>
          <div className="flex-center gap-12" style={{ flexWrap: 'wrap' }}>
            <input className="input" type="number" placeholder={`Score (max ${assignment.max_score})`} style={{ width: 160 }}
              value={gradeScore} onChange={e => setGradeScore(e.target.value)} />
            <input className="input" placeholder="Feedback (optional)" style={{ flex: 1, minWidth: 200 }}
              value={gradeFeedback} onChange={e => setGradeFeedback(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={handleGrade} disabled={saving}>
              <Star size={14} /> {saving ? 'Saving…' : 'Grade'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">This is still a draft — nothing to grade yet.</p>
      )}
    </div>
  );
}
