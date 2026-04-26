import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Login.css';

const ROLES = [
  { value: 'student', label: 'Student',  desc: 'Track assignments, focus sessions & grades' },
  { value: 'teacher', label: 'Teacher',  desc: 'Manage courses, grade submissions & monitor students' },
];

export default function SignupPage() {
  const [fullName,  setFullName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [role,      setRole]      = useState('student');
  const [loading,   setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();

    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        full_name: fullName.trim(),
        email:     email.trim().toLowerCase(),
        password,
        role,
      });

      const { access_token, refresh_token, user } = res.data.data;

      localStorage.setItem('access_token',  access_token);
      localStorage.setItem('refresh_token', refresh_token);

      toast.success(`Welcome to SkillSync, ${user.full_name}!`);

      if (user.role === 'admin')        navigate('/admin');
      else if (user.role === 'teacher') navigate('/teacher');
      else                              navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* ── Left brand panel ── */}
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo">
            <span className="logo-dot-lg" />
            <span className="login-logo-text">SkillSync</span>
          </div>
          <h1 className="login-tagline">
            Start your<br />learning journey.
          </h1>
          <p className="login-sub">
            Join thousands of students and teachers collaborating on SkillSync — your academic home.
          </p>
          <div className="login-preview-cards">
            <div className="preview-card">
              <div className="preview-dot green" />
              <span>Track your grades and performance trends</span>
            </div>
            <div className="preview-card">
              <div className="preview-dot amber" />
              <span>Focus sessions with Pomodoro timer</span>
            </div>
            <div className="preview-card">
              <div className="preview-dot red" />
              <span>Get certificates for your achievements</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="login-form-panel">
        <form className="login-form" onSubmit={handleSubmit}>

          <div className="login-form-header">
            <h2>Create account</h2>
            <p>Sign up for your SkillSync account</p>
          </div>

          {/* Role selector */}
          <div className="login-field">
            <label>I am a</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {ROLES.map(r => (
                <div
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `2px solid ${role === r.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: role === r.value ? 'var(--color-primary-soft, #fdf0f1)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    color: role === r.value ? 'var(--color-primary)' : 'var(--color-text)',
                    marginBottom: 2,
                  }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                    {r.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full name */}
          <div className="login-field">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              type="text"
              className="input"
              placeholder="Your full name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Email */}
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@university.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Confirm password */}
          <div className="login-field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              className="input"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="login-demo">
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>

        </form>
      </div>
    </div>
  );
}
