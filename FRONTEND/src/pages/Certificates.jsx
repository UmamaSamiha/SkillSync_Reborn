import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import config from '../config';

export default function Certificates() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.id) fetchCertificates();
  }, [user]);

  async function fetchCertificates() {
    setLoading(true);
    try {
      const res = await api.get(`/certificates/user/${user.id}`);
      setCertificates(res?.data?.data || []);
    } catch {
      setError('Could not load certificates.');
    }
    setLoading(false);
  }

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

  // ── Build certificate HTML sent to PDFShift ───────────────────────
  function buildCertHTML(cert) {
    const holderName = cert.holder?.full_name || user?.full_name || 'Student';
    const issueDate  = cert.issued_at
      ? new Date(cert.issued_at).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:297mm; height:210mm;
    background:#FDFAF7;
    font-family:Georgia,serif;
    display:flex; align-items:center; justify-content:center;
  }
  .page {
    width:277mm; height:190mm;
    border:2.5px solid #893941;
    outline:1px solid #CB7885;
    outline-offset:-7px;
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    padding:32px 48px; text-align:center;
    background:#FDFAF7;
  }
  .brand      { font-size:36px; font-weight:bold; color:#893941; letter-spacing:2px; margin-bottom:4px; }
  .brand-sub  { font-size:13px; color:#7A7063; font-style:italic; margin-bottom:18px; }
  .divider    { width:180px; height:1.5px; background:#893941; margin:0 auto 20px; }
  .pre        { font-size:13px; color:#7A7063; margin-bottom:8px; }
  .name       { font-size:30px; font-weight:bold; color:#893941; margin-bottom:8px; }
  .completed  { font-size:13px; color:#7A7063; font-style:italic; margin-bottom:6px; }
  .cert-title { font-size:15px; font-weight:bold; color:#2D2D2D; margin-bottom:24px; }
  .stats      { display:flex; gap:52px; justify-content:center; margin-bottom:24px; }
  .stat-val   { font-size:22px; font-weight:bold; color:#893941; }
  .stat-lbl   { font-size:10px; color:#9CA3AF; text-transform:uppercase; letter-spacing:1px; margin-top:3px; font-family:Arial,sans-serif; }
  .divider-sm { width:120px; height:0.5px; background:#D1C7BC; margin:0 auto 14px; }
  .code       { font-size:10px; color:#9CA3AF; font-family:monospace; margin-bottom:4px; }
  .url        { font-size:9px; color:#B8AFA8; font-family:Arial,sans-serif; }
</style>
</head>
<body>
<div class="page">
  <div class="brand">SkillSync</div>
  <div class="brand-sub">University Learning Platform</div>
  <div class="divider"></div>
  <div class="pre">This certifies that</div>
  <div class="name">${holderName}</div>
  <div class="completed">has successfully completed</div>
  <div class="cert-title">${cert.title || 'Certificate of Achievement — SkillSync LMS'}</div>
  <div style="font-size:11px;color:#7A7063;margin-top:6px;font-family:Arial,sans-serif;">(Based on Predicted Grade)</div>
  <div class="stats">
    ${cert.grade       ? `<div><div class="stat-val">${cert.grade}</div><div class="stat-lbl">Final Grade</div></div>` : ''}
    ${cert.study_hours != null ? `<div><div class="stat-val">${cert.study_hours}h</div><div class="stat-lbl">Study Hours</div></div>` : ''}
    ${issueDate        ? `<div><div class="stat-val" style="font-size:13px;padding-top:5px">${issueDate}</div><div class="stat-lbl">Issue Date</div></div>` : ''}
  </div>
  <div class="divider-sm"></div>
  <div class="code">Verification Code: ${cert.verification_code}</div>
  <div class="url">Verify at: skillsync.edu/verify/${cert.verification_code}</div>
</div>
</body>
</html>`;
  }

  // ── Download PDF via PDFShift external API ────────────────────────
  async function downloadPDF(cert) {
    setDownloadingId(cert.id);
    setMessage('');
    setError('');

    const apiKey = "sk_6c6593acce8d341b9a281d64a956b04bff3f40f3";

    if (!apiKey) {
      setError('PDFShift API key missing. Add REACT_APP_PDFSHIFT_KEY to your .env file.');
      setDownloadingId(null);
      return;
    }

    try {
      const html = buildCertHTML(cert);

      const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Basic ' + btoa(`api:${apiKey}`),
        },
        body: JSON.stringify({
          source:    html,
          landscape: true,
          format:    'A4',
          margin:    { top: 0, right: 0, bottom: 0, left: 0 },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`PDFShift responded with ${response.status}: ${errText}`);
      }

      const blob     = await response.blob();
      const url      = URL.createObjectURL(blob);
      const link     = document.createElement('a');
      link.href      = url;
      link.download  = `SkillSync_Certificate_${cert.verification_code}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      setMessage('PDF downloaded successfully!');
    } catch (e) {
      setError('PDF download failed: ' + e.message);
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
      <h2 style={s.title}>🏆 My Certificates</h2>
      <p style={s.sub}>Generate and download your achievement certificates as PDF</p>

      <button style={s.genBtn} onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating...' : '+ Generate Certificate'}
      </button>

      {message && <div style={s.msg(false)}>✅ {message}</div>}
      {error   && <div style={s.msg(true)}>❌ {error}</div>}

      {certificates.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🏅</div>
          <div>No certificates yet.</div>
          <div style={{ marginTop: 4, fontSize: '0.82rem' }}>Click "Generate Certificate" to create one.</div>
        </div>
      ) : (
        certificates.map((cert) => (
          <div key={cert.id} style={s.card}>
            <div style={s.cardLeft}>
              <div style={{ fontSize: 32 }}>🏆</div>
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