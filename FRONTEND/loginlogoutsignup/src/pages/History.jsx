import { useAuth } from '../context/AuthContext';

const DEMO_EMAIL = 'anushka@skillsync.edu';

const MOCK = [
  { id: 1, action: 'Focus Session',       detail: 'Algorithms — 25 min',    date: '2026-04-12', icon: '◎' },
  { id: 2, action: 'Assignment Submitted', detail: 'Assignment 3 — DSA',     date: '2026-04-11', icon: '✓' },
  { id: 3, action: 'Focus Session',       detail: 'System Design — 50 min', date: '2026-04-11', icon: '◎' },
  { id: 4, action: 'Login',               detail: 'Web session',             date: '2026-04-10', icon: '→' },
  { id: 5, action: 'Certificate Earned',  detail: 'Python Basics',           date: '2026-04-09', icon: '✦' },
  { id: 6, action: 'Focus Session',       detail: 'OS Concepts — 25 min',   date: '2026-04-08', icon: '◎' },
];

export default function HistoryPage() {
  const { user } = useAuth();
  const items = user?.email === DEMO_EMAIL ? MOCK : [];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Activity History</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 32 }}>Your recent activity log, {user?.full_name?.split(' ')[0]}.</p>

      {items.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No activity yet</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            Start a focus session or complete an assignment to see your history here.
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          {items.map((item, i) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px',
              borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(99,102,241,.15)', color: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.action}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{item.detail}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{item.date}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
