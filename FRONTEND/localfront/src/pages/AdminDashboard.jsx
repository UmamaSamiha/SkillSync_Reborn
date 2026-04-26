import { useState, useEffect } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    api.get('/auth/me')          // confirms auth works
      .then(() => {
        // In a real app you'd have GET /api/admin/users
        // For now use mock data
        setUsers([
          { id: 1, full_name: 'Anushka Demo', email: 'anushka@skillsync.edu', role: 'student', is_active: true,  last_active: '2026-04-12' },
          { id: 2, full_name: 'Reza Ahmed',   email: 'reza@skillsync.edu',   role: 'student', is_active: true,  last_active: '2026-04-11' },
          { id: 3, full_name: 'Admin User',   email: 'admin@skillsync.edu',  role: 'admin',   is_active: true,  last_active: '2026-04-12' },
        ]);
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, color: 'var(--color-muted)' }}>Loading...</div>;
  if (error)   return <div style={{ padding: 40, color: 'var(--color-red)' }}>{error}</div>;

  const stats = [
    { label: 'Total Users',    value: users.length },
    { label: 'Students',       value: users.filter(u => u.role === 'student').length },
    { label: 'Active Today',   value: users.filter(u => u.last_active === '2026-04-12').length },
    { label: 'Admins',         value: users.filter(u => u.role === 'admin').length },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Admin Dashboard</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 32 }}>Manage users and monitor activity.</p>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        {stats.map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, padding: '16px 24px', minWidth: 140,
          }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-primary)' }}>{value}</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>All Users</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,.03)' }}>
              {['Name', 'Email', 'Role', 'Status', 'Last Active', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: 'var(--color-muted)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{u.full_name}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-muted)' }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                    background: u.role === 'admin' ? 'rgba(99,102,241,.2)' : 'rgba(34,197,94,.15)',
                    color: u.role === 'admin' ? 'var(--color-primary)' : 'var(--color-green)',
                    textTransform: 'capitalize',
                  }}>{u.role}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 11, color: u.is_active ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {u.is_active ? '● Active' : '● Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-muted)' }}>{u.last_active}</td>
                <td style={{ padding: '12px 16px' }}>
                  <Link to={`/member/${u.id}`} style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
