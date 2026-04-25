import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import './QuestionBank.css';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const TYPES        = ['mcq', 'true_false', 'short_answer'];


// ── Student Quiz View ──────────────────────────────────────────────────────────
function QuizView({ bank, questions }) {
  const [answers,   setAnswers]   = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score,     setScore]     = useState(null);

  const handleAnswer = (qId, val) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmit = () => {
    const unanswered = questions.filter(q => answers[q.id] === undefined || answers[q.id] === '');
    if (unanswered.length > 0) {
      toast.error(`Please answer all ${unanswered.length} remaining question(s) first`);
      return;
    }
    let correct = 0;
    questions.forEach(q => {
      const user  = String(answers[q.id] ?? '').trim().toLowerCase();
      const right = String(q.correct_answer ?? '').trim().toLowerCase();
      if (user === right) correct++;
    });
    setScore({ correct, total: questions.length });
    setSubmitted(true);
  };

  const handleReset = () => { setAnswers({}); setSubmitted(false); setScore(null); };

  const isCorrect = (q) =>
    String(answers[q.id] ?? '').trim().toLowerCase() ===
    String(q.correct_answer ?? '').trim().toLowerCase();

  if (questions.length === 0) return <p className="qb-muted">No questions in this bank yet.</p>;

  const pct = score ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="quiz-wrap">

      {/* Score banner */}
      {submitted && score && (
        <div className={`quiz-score-banner ${pct === 100 ? 'perfect' : pct >= 70 ? 'good' : 'poor'}`}>
          <div className="quiz-score-left">
            <span className="quiz-score-num">{score.correct}/{score.total}</span>
            <span className="quiz-score-pct">{pct}%</span>
          </div>
          <span className="quiz-score-msg">
            {pct === 100 ? '🎉 Perfect score!' : pct >= 70 ? '👍 Good job!' : '📖 Keep practicing'}
          </span>
          <button className="btn" onClick={handleReset}>Try Again</button>
        </div>
      )}

      {questions.map((q, i) => {
        const correct   = submitted && isCorrect(q);
        const incorrect = submitted && !isCorrect(q);

        return (
          <div key={q.id} className={`quiz-card ${submitted ? (correct ? 'quiz-correct' : 'quiz-incorrect') : ''}`}>

            <div className="qb-q-meta">
              <span className={`qb-badge qb-diff-${q.difficulty}`}>{q.difficulty}</span>
              <span className="qb-badge qb-type">{q.question_type.replace('_', ' ')}</span>
              <span className="qb-pts">{q.points} pt{q.points > 1 ? 's' : ''}</span>
              {submitted && (
                <span className={`quiz-result-badge ${correct ? 'result-correct' : 'result-incorrect'}`}>
                  {correct ? '✅ Correct' : '❌ Incorrect'}
                </span>
              )}
            </div>

            <p className="qb-q-text"><strong>{i + 1}.</strong> {q.text}</p>

            {/* MCQ */}
            {q.question_type === 'mcq' && (
              <ul className="quiz-options">
                {q.options.map((opt, j) => {
                  const selected = answers[q.id] === opt;
                  const isRight  = submitted && opt === q.correct_answer;
                  const isWrong  = submitted && selected && !isRight;
                  return (
                    <li key={j}
                      className={`quiz-option ${selected ? 'selected' : ''} ${isRight ? 'opt-correct' : ''} ${isWrong ? 'opt-wrong' : ''}`}
                      onClick={() => handleAnswer(q.id, opt)}
                    >
                      <span className="quiz-radio">
                        {isRight ? '✅' : isWrong ? '❌' : selected ? '●' : '○'}
                      </span>
                      {opt}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* True / False */}
            {q.question_type === 'true_false' && (
              <div className="quiz-tf">
                {['true', 'false'].map(val => {
                  const selected = answers[q.id] === val;
                  const isRight  = submitted && val === String(q.correct_answer).toLowerCase();
                  const isWrong  = submitted && selected && !isRight;
                  return (
                    <button key={val}
                      className={`quiz-tf-btn ${selected ? 'selected' : ''} ${isRight ? 'opt-correct' : ''} ${isWrong ? 'opt-wrong' : ''}`}
                      onClick={() => handleAnswer(q.id, val)}
                    >
                      {isRight ? '✅ ' : isWrong ? '❌ ' : ''}{val.charAt(0).toUpperCase() + val.slice(1)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Short Answer */}
            {q.question_type === 'short_answer' && (
              <div className="quiz-short">
                <input
                  className={`quiz-short-input ${submitted ? (correct ? 'input-correct' : 'input-wrong') : ''}`}
                  value={answers[q.id] || ''}
                  onChange={e => handleAnswer(q.id, e.target.value)}
                  placeholder="Type your answer…"
                  disabled={submitted}
                />
                {submitted && incorrect && (
                  <p className="quiz-correct-ans">
                    Correct answer: <strong>{q.correct_answer}</strong>
                  </p>
                )}
              </div>
            )}

          </div>
        );
      })}

      {!submitted && (
        <button className="btn btn-primary quiz-submit-btn" onClick={handleSubmit}>
          Submit Answers
        </button>
      )}
    </div>
  );
}


// ── Teacher View ───────────────────────────────────────────────────────────────
function TeacherView({ bank, questions, onDelete, showQForm, onCancelAdd, onQuestionAdded }) {
  const [qText,    setQText]    = useState('');
  const [qType,    setQType]    = useState('mcq');
  const [qDiff,    setQDiff]    = useState('beginner');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qAnswer,  setQAnswer]  = useState('');
  const [qPoints,  setQPoints]  = useState(1);
  const [saving,   setSaving]   = useState(false);

  const reset = () => {
    setQText(''); setQType('mcq'); setQDiff('beginner');
    setQOptions(['', '', '', '']); setQAnswer(''); setQPoints(1);
    onCancelAdd();
  };

  const handleAdd = async () => {
    if (!qText.trim()) return toast.error('Question text is required');
    const correct  = qType === 'true_false' ? qAnswer.toLowerCase() : qAnswer;
    const payload  = {
      text: qText.trim(), question_type: qType, difficulty: qDiff,
      correct_answer: correct, points: qPoints,
      options: qType === 'mcq' ? qOptions.filter(o => o.trim()) : [],
    };
    setSaving(true);
    try {
      await api.post(`/question-bank/banks/${bank.id}/questions`, payload);
      toast.success('Question added!');
      reset();
      onQuestionAdded();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add question');
    } finally { setSaving(false); }
  };

  return (
    <div>
      {showQForm && (
        <div className="qb-card qb-q-form">
          <div className="qb-field">
            <label>Question *</label>
            <textarea value={qText} onChange={e => setQText(e.target.value)} rows={3} placeholder="Enter the question…" />
          </div>
          <div className="qb-row">
            <div className="qb-field">
              <label>Type</label>
              <select value={qType} onChange={e => { setQType(e.target.value); setQAnswer(''); }}>
                {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="qb-field">
              <label>Difficulty</label>
              <select value={qDiff} onChange={e => setQDiff(e.target.value)}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="qb-field">
              <label>Points</label>
              <input type="number" min={1} value={qPoints} onChange={e => setQPoints(Number(e.target.value))} />
            </div>
          </div>
          {qType === 'mcq' && (
            <div className="qb-field">
              <label>Options</label>
              {qOptions.map((opt, i) => (
                <input key={i} value={opt}
                  onChange={e => { const u = [...qOptions]; u[i] = e.target.value; setQOptions(u); }}
                  placeholder={`Option ${i + 1}`} style={{ marginBottom: '0.4rem' }} />
              ))}
            </div>
          )}
          <div className="qb-field">
            <label>Correct Answer</label>
            {qType === 'true_false' ? (
              <select value={qAnswer} onChange={e => setQAnswer(e.target.value)}>
                <option value="">— select —</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input value={qAnswer} onChange={e => setQAnswer(e.target.value)}
                placeholder={qType === 'mcq' ? 'Must match one of the options above' : 'Type the answer'} />
            )}
          </div>
          <div className="qb-actions">
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving…' : 'Add Question'}
            </button>
            <button className="btn" onClick={reset}>Cancel</button>
          </div>
        </div>
      )}

      {questions.length === 0 && !showQForm && <p className="qb-muted">No questions yet. Add some above!</p>}

      {questions.map((q, i) => (
        <div key={q.id} className="qb-q-card">
          <div className="qb-q-meta">
            <span className={`qb-badge qb-diff-${q.difficulty}`}>{q.difficulty}</span>
            <span className="qb-badge qb-type">{q.question_type.replace('_', ' ')}</span>
            <span className="qb-pts">{q.points} pt{q.points > 1 ? 's' : ''}</span>
            <button className="qb-delete-btn" onClick={() => onDelete(q.id)}>🗑</button>
          </div>
          <p className="qb-q-text"><strong>{i + 1}.</strong> {q.text}</p>
          {q.question_type === 'mcq' && q.options?.length > 0 && (
            <ul className="qb-options">
              {q.options.map((opt, j) => (
                <li key={j} className={opt === q.correct_answer ? 'correct' : ''}>
                  {opt === q.correct_answer ? '✅' : '○'} {opt}
                </li>
              ))}
            </ul>
          )}
          {q.question_type !== 'mcq' && <p className="qb-answer">✅ {q.correct_answer}</p>}
        </div>
      ))}
    </div>
  );
}


// ── Main Page ──────────────────────────────────────────────────────────────────
export default function QuestionBankPage() {
  const { user } = useAuth();
  const canEdit  = user?.role === 'teacher' || user?.role === 'admin';

  const [banks,        setBanks]        = useState([]);
  const [activeBank,   setActiveBank]   = useState(null);
  const [questions,    setQuestions]    = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [loadingQs,    setLoadingQs]    = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [showQForm,    setShowQForm]    = useState(false);
  const [bankTitle,    setBankTitle]    = useState('');
  const [bankDesc,     setBankDesc]     = useState('');
  const [saving,       setSaving]       = useState(false);

  const loadBanks = () => {
    setLoadingBanks(true);
    api.get('/question-bank/banks')
      .then(res => setBanks(res.data.data || []))
      .catch(() => toast.error('Could not load banks'))
      .finally(() => setLoadingBanks(false));
  };

  useEffect(() => { loadBanks(); }, []);

  const loadQuestions = (bank) => {
    setActiveBank(bank);
    setShowQForm(false);
    setLoadingQs(true);
    api.get(`/question-bank/banks/${bank.id}/questions`)
      .then(res => setQuestions(res.data.data || []))
      .catch(() => toast.error('Could not load questions'))
      .finally(() => setLoadingQs(false));
  };

  const handleCreateBank = async () => {
    if (!bankTitle.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      await api.post('/question-bank/banks', { title: bankTitle.trim(), description: bankDesc.trim() });
      toast.success('Bank created!');
      setBankTitle(''); setBankDesc(''); setShowBankForm(false);
      loadBanks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  };

  const handleDeleteBank = async (bankId) => {
    if (!window.confirm('Delete this entire bank and all its questions?')) return;
    try {
      await api.delete(`/question-bank/banks/${bankId}`);
      toast.success('Bank deleted');
      if (activeBank?.id === bankId) { setActiveBank(null); setQuestions([]); }
      loadBanks();
    } catch { toast.error('Delete failed'); }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await api.delete(`/question-bank/banks/${activeBank.id}/questions/${qId}`);
      toast.success('Question deleted');
      setQuestions(prev => prev.filter(q => q.id !== qId));
    } catch { toast.error('Delete failed'); }
  };

  const reloadQuestions = () => {
    if (!activeBank) return;
    api.get(`/question-bank/banks/${activeBank.id}/questions`)
      .then(res => setQuestions(res.data.data || []));
  };

  return (
    <div className="qb-page">

      <div className="qb-header">
        <h1>📚 Question Bank</h1>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowBankForm(!showBankForm)}>
            + New Bank
          </button>
        )}
      </div>

      {showBankForm && (
        <div className="qb-card">
          <h2>Create Question Bank</h2>
          <div className="qb-field">
            <label>Title *</label>
            <input value={bankTitle} onChange={e => setBankTitle(e.target.value)} placeholder="e.g. Midterm Bank" />
          </div>
          <div className="qb-field">
            <label>Description</label>
            <textarea value={bankDesc} onChange={e => setBankDesc(e.target.value)} rows={2} placeholder="Optional description" />
          </div>
          <div className="qb-actions">
            <button className="btn btn-primary" onClick={handleCreateBank} disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button className="btn" onClick={() => setShowBankForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="qb-layout">

        {/* Banks sidebar */}
        <div className="qb-banks">
          <h2>Banks</h2>
          {loadingBanks && <p className="qb-muted">Loading…</p>}
          {!loadingBanks && banks.length === 0 && <p className="qb-muted">No banks yet.</p>}
          {banks.map(bank => (
            <div key={bank.id}
              className={`qb-bank-item ${activeBank?.id === bank.id ? 'active' : ''}`}
              onClick={() => loadQuestions(bank)}
            >
              <div className="qb-bank-info">
                <span className="qb-bank-title">{bank.title}</span>
                <span className="qb-bank-count">{bank.total} question{bank.total !== 1 ? 's' : ''}</span>
              </div>
              {canEdit && (
                <button className="qb-delete-btn"
                  onClick={e => { e.stopPropagation(); handleDeleteBank(bank.id); }}
                >🗑</button>
              )}
            </div>
          ))}
        </div>

        {/* Questions panel */}
        <div className="qb-questions">
          {!activeBank && (
            <div className="qb-empty-state">
              <p>← Select a bank to {canEdit ? 'manage questions' : 'start the quiz'}</p>
            </div>
          )}

          {activeBank && (
            <>
              <div className="qb-questions-header">
                <div>
                  <h2>{activeBank.title}</h2>
                  <p className="qb-role-hint">
                    {canEdit
                      ? '👩‍🏫 Teacher view — you can see and manage answers'
                      : '🎓 Answer all questions, then click Submit to see your score'}
                  </p>
                </div>
                {canEdit && (
                  <button className="btn btn-primary" onClick={() => setShowQForm(!showQForm)}>
                    + Add Question
                  </button>
                )}
              </div>

              {loadingQs && <p className="qb-muted">Loading questions…</p>}

              {!loadingQs && (
                canEdit
                  ? <TeacherView
                      bank={activeBank}
                      questions={questions}
                      onDelete={handleDeleteQuestion}
                      showQForm={showQForm}
                      onCancelAdd={() => setShowQForm(false)}
                      onQuestionAdded={reloadQuestions}
                    />
                  : <QuizView bank={activeBank} questions={questions} />
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}