import { useParams } from 'react-router-dom';

const MOCK_MEMBERS = {
  1: { full_name: 'Anushka Demo', email: 'anushka@skillsync.edu', role: 'student', sessions: 47, streak: 14, certificates: 3 },
  2: { full_name: 'Reza Ahmed',   email: 'reza@skillsync.edu',   role: 'student', sessions: 31, streak: 7,  certificates: 1 },
};

export default function MemberDetailPage() {
  const { userId } = useParams();
  const member = MOCK_MEMBERS[userId] ?? { full_name: 'Unknown Member', email: '—', role: 'student', sessions: 0, streak: 0, certificates: 0 };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Member Profile</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 32 }}>Viewing {member.full_name}'s activity.</p>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 28, maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 22, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{member.full_name[0]}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{member.full_name}</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{member.email}</div>
            <div style={{ fontSize: 12, color: 'var(--color-primary)', textTransform: 'capitalize', marginTop: 2 }}>{member.role}</div>
          </div>
        </div>

        {[
          { label: 'Focus Sessions', value: member.sessions },
          { label: 'Current Streak', value: `${member.streak} days` },
          { label: 'Certificates',   value: member.certificates },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>{label}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
