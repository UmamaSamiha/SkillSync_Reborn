import { useAuth } from '../context/AuthContext';

const DEMO_EMAIL = 'anushka@skillsync.edu';

export default function HeatmapPage() {
  const { user } = useAuth();
  const isDemo = user?.email === DEMO_EMAIL;

  const weeks = Array.from({ length: 20 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => ({
      key: `${wi}-${di}`,
      level: isDemo ? Math.floor(Math.random() * 5) : 0,
    }))
  );

  const colors = ['#1a1d27', '#1e3a5f', '#1e6091', '#1a9ec9', '#6366f1'];

  const stats = isDemo
    ? [
        { label: 'Total Focus Sessions', value: '47' },
        { label: 'Current Streak',       value: '14 days' },
        { label: 'Assignments Done',     value: '23' },
        { label: 'Certificates Earned',  value: '3' },
      ]
    : [
        { label: 'Total Focus Sessions', value: '0' },
        { label: 'Current Streak',       value: '0 days' },
        { label: 'Assignments Done',     value: '0' },
        { label: 'Certificates Earned',  value: '0' },
      ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Welcome back, {user?.full_name?.split(' ')[0]} 👋
      </h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 32 }}>
        Here's your activity overview.
      </p>

      {/* Heatmap */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Activity Heatmap</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {week.map(({ key, level }) => (
                <div key={key} title={`Level ${level}`} style={{
                  width: 14, height: 14, borderRadius: 3,
                  background: colors[level],
                  transition: 'transform .1s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => e.target.style.transform = 'scale(1.3)'}
                onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Less</span>
          {colors.map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />)}
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>More</span>
        </div>
      </div>

      {/* Stats row */}
      {stats.map(({ label, value }) => (
        <div key={label} style={{
          display: 'inline-block', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 12,
          padding: '16px 24px', marginRight: 16, marginBottom: 16,
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)' }}>{value}</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
