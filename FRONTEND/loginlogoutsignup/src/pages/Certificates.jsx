import { useAuth } from '../context/AuthContext';

const DEMO_EMAIL = 'anushka@skillsync.edu';

const MOCK_CERTS = [
  { id: 1, title: 'Python Basics',         issuer: 'SkillSync',  date: '2026-04-09', color: '#6366f1' },
  { id: 2, title: 'Data Structures & Algorithms', issuer: 'SkillSync', date: '2026-03-22', color: '#22c55e' },
  { id: 3, title: '30-Day Focus Streak',   issuer: 'SkillSync',  date: '2026-03-01', color: '#f59e0b' },
];

export default function Certificates() {
  const { user } = useAuth();
  const certs = user?.email === DEMO_EMAIL ? MOCK_CERTS : [];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Certificates</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 32 }}>Your earned achievements.</p>

      {certs.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No certificates yet</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            Complete courses and maintain streaks to earn certificates.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {certs.map(cert => (
            <div key={cert.id} style={{
              width: 300, background: 'var(--color-surface)',
              border: `1px solid ${cert.color}40`,
              borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 100, height: 100, borderRadius: '50%',
                background: `${cert.color}18`,
              }} />
              <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{cert.title}</div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16 }}>Issued by {cert.issuer}</div>
              <div style={{
                display: 'inline-block', background: `${cert.color}20`,
                color: cert.color, fontSize: 12, fontWeight: 600,
                padding: '4px 10px', borderRadius: 20,
              }}>{cert.date}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
