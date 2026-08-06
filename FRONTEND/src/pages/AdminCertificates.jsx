import { useState } from "react";
import { Award, Trophy, Download, CheckCircle2, XCircle, AlertTriangle, Loader2, Medal } from "lucide-react";
import api from "../utils/api";
import { safeData, Badge, card, btn, AdminPage } from "../components/admin/adminShared";

export default function AdminCertificates() {
  const [classified,   setClassified]   = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [certMsg,      setCertMsg]      = useState("");
  const [certLoading,  setCertLoading]  = useState({});
  const [loading,      setLoading]      = useState(false);

  const loadClassification = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/student-classification");
      setClassified(safeData(res, []));
    } catch {
      setClassified([]);
    }
    setLoading(false);
  };

  const generateCert = async (studentId, studentName) => {
    setCertLoading(prev => ({ ...prev, [studentId]: true }));
    setCertMsg("");
    try {
      const res  = await api.post("/certificates/generate", {
        user_id: studentId,
        title:   "Certificate of Achievement — SkillSync LMS",
      });
      const cert = res.data?.data || null;
      if (!cert) throw new Error("No cert returned");
      setCertificates(prev => {
        const filtered = prev.filter(c => c.user_id !== studentId);
        return [...filtered, { ...cert, student_name: studentName }];
      });
      setCertMsg(`✅ Generated for ${studentName}`);
    } catch (e) {
      setCertMsg(`❌ Failed for ${studentName}: ${e?.response?.data?.error || e.message}`);
    }
    setCertLoading(prev => ({ ...prev, [studentId]: false }));
  };

  const generateAllCerts = async () => {
    let list = classified;
    if (!list.length) {
      setLoading(true);
      try {
        const res = await api.get("/admin/student-classification");
        list = safeData(res, []);
        setClassified(list);
      } catch {
        list = [];
      }
      setLoading(false);
    }
    setCertMsg("Generating for all students...");
    setCertificates([]);
    for (const s of list) {
      await generateCert(s?.user?.id, s?.user?.full_name);
    }
    setCertMsg(`✅ Done! Generated ${list.length} certificates.`);
  };

  return (
    <AdminPage
      title="Certificates"
      icon={<Award size={20} style={{ marginRight: -2 }} />}
      subtitle="Generate and manage achievement certificates for students"
      actions={<>
        {!classified.length && (
          <button style={btn("ghost")} onClick={loadClassification}>Load Students</button>
        )}
        <button style={{ ...btn("primary"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={generateAllCerts} disabled={loading}>
          <Award size={13} /> Generate All
        </button>
      </>}
    >
      {certMsg && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, marginBottom: 14,
          background: certMsg.startsWith("✅") ? "#DCFCE7" : certMsg.startsWith("❌") ? "#FEE2E2" : "#FEF3C7",
          color:      certMsg.startsWith("✅") ? "#166534" : certMsg.startsWith("❌") ? "#991B1B" : "#92400E",
          fontSize: "0.88rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {certMsg.startsWith("✅") ? <CheckCircle2 size={15} /> : certMsg.startsWith("❌") ? <XCircle size={15} /> : <AlertTriangle size={15} />}
          {certMsg.replace(/^[✅❌]\s*/, "")}
        </div>
      )}

      {classified.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: "#7A7063", fontSize: "0.85rem" }}>
            GENERATE FOR INDIVIDUAL STUDENTS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {classified.map(s => (
              <button
                key={s?.user?.id}
                style={{ ...btn("ghost"), fontSize: "0.78rem", padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
                onClick={() => generateCert(s?.user?.id, s?.user?.full_name)}
                disabled={certLoading[s?.user?.id]}
              >
                {certLoading[s?.user?.id] ? <Loader2 size={12} className="spin-icon" /> : <Medal size={12} />} {s?.user?.full_name?.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {certificates.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 10, color: "#7A7063", fontSize: "0.85rem" }}>
            GENERATED CERTIFICATES ({certificates.length})
          </div>
          {certificates.map((c, i) => (
            <div key={c.id || i} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Trophy size={26} style={{ color: "#893941", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{c.student_name || c.holder?.full_name}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{c.title}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {c.grade && <Badge text={`Grade: ${c.grade}`} bg="#D4D994" color="#5E6623" />}
                {c.study_hours != null && (
                  <Badge text={`${c.study_hours}h studied`} bg="#DBEAFE" color="#1E40AF" />
                )}
                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>
                  {c.verification_code}
                </div>
                {c.download_url && (
                  <a
                    href={`http://127.0.0.1:5000/api${c.download_url}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...btn("ghost"), textDecoration: "none", padding: "5px 12px", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <Download size={13} /> Download PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {certificates.length === 0 && !certMsg && (
        <div style={{ ...card, textAlign: "center", color: "#9CA3AF", padding: 40 }}>
          No certificates generated yet. Click "Generate All" to begin.
        </div>
      )}
    </AdminPage>
  );
}
