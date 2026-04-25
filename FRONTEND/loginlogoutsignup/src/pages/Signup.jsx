import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Login.css';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [role,     setRole]     = useState('student');
  const [loading,  setLoading]  = useState(false);
  const { signup } = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (password.length < 8)  { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const user = await signup(email, password, fullName, role);
      toast.success('Account created!');
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo">
            <span className="logo-dot-lg" />
            <span className="login-logo-text">SkillSync</span>
          </div>
          <h1 className="login-tagline">Start your<br />learning journey.</h1>
          <p className="login-sub">
            Join thousands of students tracking progress, building habits, and growing together.
          </p>
          <div className="login-preview-cards">
            <div className="preview-card"><div className="preview-dot green" /><span>Track daily study streaks</span></div>
            <div className="preview-card"><div className="preview-dot amber" /><span>Prerequisite-based learning path</span></div>
            <div className="preview-card"><div className="preview-dot red" /><span>Build and share your portfolio</span></div>
          </div>
        </div>
      </div>

      <div className="login-form-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form-header">
            <h2>Create account</h2>
            <p>Join SkillSync for free</p>
          </div>

          <div className="login-field">
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" type="text" className="input" placeholder="Your full name"
              value={fullName} onChange={e => setFullName(e.target.value)} required autoFocus />
          </div>

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" placeholder="you@university.edu"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="login-field">
            <label htmlFor="role">I am a</label>
            <select
              id="role"
              className="input"
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className="input" placeholder="Min. 8 characters"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          <div className="login-field">
            <label htmlFor="confirm">Confirm Password</label>
            <input id="confirm" type="password" className="input" placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign Up'}
          </button>

          <p className="login-demo">
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}