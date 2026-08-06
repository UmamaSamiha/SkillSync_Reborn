import { useState } from "react";
import { ShieldCheck, XCircle, CheckCircle2, ShieldX } from "lucide-react";
import api from "../utils/api";
import { safeData, card, btn, inputStyle, AdminPage } from "../components/admin/adminShared";

export default function AdminVerify() {
  const [verifyCode,   setVerifyCode]   = useState("");
  const [verifyResult, setVerifyResult] = useState(null);

  const verifyCert = async () => {
    if (!verifyCode.trim()) return;
    setVerifyResult(null);
    try {
      const res = await api.get(`/certificates/verify/${verifyCode.trim()}`);
      setVerifyResult(safeData(res, null));
    } catch {
      setVerifyResult({ error: "Certificate not found or invalid code." });
    }
  };

  return (
    <AdminPage
      title="Verify Certificate"
      icon={<ShieldCheck size={20} style={{ marginRight: -2 }} />}
      subtitle="Look up a certificate by its verification code"
    >
      <div style={{ ...card, maxWidth: 480 }}>
        <div style={{ fontSize: "0.88rem", color: "#7A7063", marginBottom: 12 }}>
          Enter a certificate verification code (e.g. <code>SS-ABCD1234EF</code>)
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={verifyCode}
            onChange={e => setVerifyCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && verifyCert()}
            placeholder="SS-XXXXXXXXXX"
            style={{ ...inputStyle, fontFamily: "monospace", textTransform: "uppercase" }}
          />
          <button style={btn("primary")} onClick={verifyCert}>Verify</button>
        </div>

        {verifyResult && (
          <div style={{
            marginTop: 16,
            padding: "14px 18px",
            borderRadius: 12,
            background: verifyResult.error ? "#FEE2E2" : "#DCFCE7",
            border: `1px solid ${verifyResult.error ? "#FECACA" : "#BBF7D0"}`,
          }}>
            {verifyResult.error ? (
              <div style={{ color: "#991B1B", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <XCircle size={16} /> {verifyResult.error}
              </div>
            ) : (
              <div>
                <div style={{ color: "#166534", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={16} /> Valid Certificate
                </div>
                <div style={{ fontSize: "0.88rem", color: "#2D2D2D" }}>
                  <div><b>Holder:</b> {verifyResult.holder?.full_name}</div>
                  <div><b>Title:</b> {verifyResult.title}</div>
                  {verifyResult.grade && <div><b>Grade:</b> {verifyResult.grade}</div>}
                  {verifyResult.study_hours != null && <div><b>Study Hours:</b> {verifyResult.study_hours}h</div>}
                  <div><b>Issued:</b> {verifyResult.issued_at ? new Date(verifyResult.issued_at).toLocaleDateString() : "—"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <b>Status:</b> {verifyResult.valid
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#166534" }}><CheckCircle2 size={13} /> Active</span>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#991B1B" }}><ShieldX size={13} /> Revoked</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminPage>
  );
}
