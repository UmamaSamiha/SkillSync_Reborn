import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Login.css';
import { Link } from 'react-router-dom';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success('Welcome back!');
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
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
          <h1 className="login-tagline">
            Track, learn,<br />and grow together.
          </h1>
          <p className="login-sub">
            A collaborative academic platform for teams that care about progress.
          </p>
          <div className="login-preview-cards">
            <div className="preview-card">
              <div className="preview-dot green" />
              <span>Anushka submitted Assignment 3</span>
            </div>
            <div className="preview-card">
              <div className="preview-dot amber" />
              <span>Focus session — 25 min — Algorithms</span>
            </div>
            <div className="preview-card">
              <div className="preview-dot red" />
              <span>System Design due in 2 days</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form-header">
            <h2>Welcome back</h2>
            <p>Sign in to your SkillSync account</p>
          </div>

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
              autoFocus
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="login-demo">
            Demo: <code>anushka@skillsync.edu</code> / <code>password123</code>
          </p>
          <p className="login-demo">
  Don't have an account?{' '}
  <Link to="/signup" style={{ color: 'var(--color-primary)',   fontWeight: 600 }}>
    Sign up
  </Link>
        </p>

        </form>
      </div>
    </div>
  );
}