import { useState, useEffect, useCallback } from 'react';
import { Award, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';


export default function Certificates() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/certificates/user/${user.id}`);
      setCertificates(res?.data?.data || []);
    } catch {
      setError('Could not load certificates.');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user?.id) fetchCertificates();
  }, [user, fetchCertificates]);

  async function handleGenerate() {
    setGenerating(true);
    setMessage('');
    setError('');
    try {
      const res = await api.post('/certificates/generate', {
        user_id: user.id,
        title: 'Certificate of Achievement — SkillSync LMS',
      });
      const cert = res?.data?.data;
      if (!cert) throw new Error('No certificate returned');
      setCertificates(prev => [cert, ...prev.filter(c => c.id !== cert.id)]);
      setMessage('Certificate generated successfully!');
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to generate certificate.');
    }
    setGenerating(false);
  }

  // ── Download the PDF the backend already generated for this certificate ──
  async function downloadPDF(cert) {
    setDownloadingId(cert.id);
    setMessage('');
    setError('');
    try {
      const res = await api.get(`/certificates/${cert.id}/download`, { responseType: 'blob' });
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href     = url;
      link.download = `SkillSync_Certificate_${cert.verification_code}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('PDF downloaded successfully!');
    } catch (e) {
      setError(e?.response?.data?.error || 'PDF download failed.');
    }
    setDownloadingId(null);
  }

  // ── Styles ────────────────────────────────────────────────────────
  const s = {
    page:  { padding: '32px 28px', maxWidth: 720, fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#2D2D2D' },
    title: { margin: 0, fontSize: '1.5rem', fontFamily: 'Georgia, serif', color: '#893941' },
    sub:   { margin: '4px 0 20px', fontSize: '0.88rem', color: '#7A7063' },
    genBtn: {
      padding: '10px 22px', background: '#893941', color: '#fff',
      border: 'none', borderRadius: 10, fontSize: '0.88rem', fontWeight: 600,
      cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1, marginBottom: 20,
    },
    msg: (isErr) => ({
      padding: '10px 16px', borderRadius: 10, marginBottom: 14,
      fontSize: '0.85rem', fontWeight: 600,
      background: isErr ? '#FEE2E2' : '#DCFCE7',
      color:      isErr ? '#991B1B' : '#166534',
    }),
    empty: {
      padding: '48px 0', textAlign: 'center', color: '#9CA3AF',
      fontSize: '0.9rem', border: '1px dashed #E5E7EB', borderRadius: 14,
    },
    card: {
      background: '#FDFAF7', border: '1px solid rgba(137,57,65,0.12)',
      borderRadius: 16, padding: '20px 24px', marginBottom: 14,
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', flexWrap: 'wrap', gap: 12,
    },
    cardLeft:  { display: 'flex', gap: 14, alignItems: 'center' },
    certTitle: { fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 },
    certMeta:  { fontSize: '0.8rem', color: '#7A7063' },
    code:      { fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 },
    cardRight: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    badge: (bg, color) => ({
      background: bg, color, fontSize: 11, fontWeight: 700,
      padding: '2px 10px', borderRadius: 999,
    }),
    dlBtn: (disabled) => ({
      padding: '7px 16px', background: 'transparent',
      color: disabled ? '#9CA3AF' : '#893941',
      border: `1px solid ${disabled ? '#E5E7EB' : '#893941'}`,
      borderRadius: 10, fontSize: '0.8rem', fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }),
  };

  if (loading) return <div style={s.page}><p style={{ color: '#9CA3AF' }}>Loading certificates...</p></div>;

  return (
    <div style={s.page}>
      <h2 style={s.title}><Award size={20} style={{ verticalAlign: '-3px', marginRight: 8 }} /> My Certificates</h2>
      <p style={s.sub}>Generate and download your achievement certificates as PDF</p>

      <button style={s.genBtn} onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating...' : '+ Generate Certificate'}
      </button>

      {message && <div style={{ ...s.msg(false), display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} /> {message}</div>}
      {error   && <div style={{ ...s.msg(true),  display: 'flex', alignItems: 'center', gap: 8 }}><XCircle size={16} /> {error}</div>}

      {certificates.length === 0 ? (
        <div style={s.empty}>
          <Award size={36} style={{ marginBottom: 10, opacity: 0.5 }} />
          <div>No certificates yet.</div>
          <div style={{ marginTop: 4, fontSize: '0.82rem' }}>Click "Generate Certificate" to create one.</div>
        </div>
      ) : (
        certificates.map((cert) => (
          <div key={cert.id} style={s.card}>
            <div style={s.cardLeft}>
              <Award size={28} style={{ color: '#893941', flexShrink: 0 }} />
              <div>
                <div style={s.certTitle}>{cert.title}</div>
                <div style={s.certMeta}>
                  {cert.issued_at
                    ? new Date(cert.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—'}
                </div>
                <div style={s.code}>{cert.verification_code}</div>
              </div>
            </div>
            <div style={s.cardRight}>
              {cert.course_title && <span style={s.badge('#FDE9C8', '#8A5A00')}>{cert.course_title}</span>}
              {cert.grade        && <span style={s.badge('#D4D994', '#5E6623')}>Grade: {cert.grade}</span>}
              {cert.study_hours != null && <span style={s.badge('#DBEAFE', '#1E40AF')}>{cert.study_hours}h studied</span>}
              {cert.is_valid === false   && <span style={s.badge('#FEE2E2', '#991B1B')}>Revoked</span>}
              <button
                style={s.dlBtn(downloadingId === cert.id || cert.is_valid === false)}
                onClick={() => downloadPDF(cert)}
                disabled={downloadingId === cert.id || cert.is_valid === false}
              >
                {downloadingId === cert.id ? 'Generating PDF...' : '⬇ Download PDF'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}