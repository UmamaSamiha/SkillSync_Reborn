import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Mail, RefreshCw, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import api from "../utils/api";
import {
  safeData, Spinner, Badge, Avatar, RISK_META, TREND_ICON, TREND_COLOR,
  card, btn, AdminPage,
} from "../components/admin/adminShared";

export default function AdminRisk() {
  const [riskStudents, setRiskStudents] = useState([]);
  const [loading,       setLoading]     = useState(false);
  const [alertSending,  setAlertSending] = useState(false);
  const [alertMsg,      setAlertMsg]     = useState("");

  const loadRisk = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/risk-alerts");
      setRiskStudents(safeData(res, []));
    } catch { setRiskStudents([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadRisk(); }, [loadRisk]);

  const recalcRisk = async (userId) => {
    try {
      await api.post(`/admin/recalculate-risk/${userId}`);
      loadRisk();
    } catch (e) {
      alert("Recalculation failed: " + (e?.response?.data?.error || e.message));
    }
  };

  const recalcAllRisk = async () => {
    setLoading(true);
    try {
      await api.post("/admin/recalculate-all-risk");
      await loadRisk();
    } catch (e) {
      alert("Failed: " + (e?.response?.data?.error || e.message));
    }
    setLoading(false);
  };

  const sendRiskAlerts = async () => {
    setAlertSending(true);
    setAlertMsg("");
    try {
      const res  = await api.post("/admin/send-risk-alerts");
      const data = safeData(res, null);
      setAlertMsg(`✅ Alerts sent to ${data?.sent_count || 0} students${data?.failed_count ? `, ${data.failed_count} failed` : ""}`);
    } catch (e) {
      setAlertMsg("❌ Failed to send alerts: " + (e?.response?.data?.error || e.message));
    }
    setAlertSending(false);
  };

  return (
    <AdminPage
      title="Risk Detection"
      icon={<AlertTriangle size={20} style={{ marginRight: -2 }} />}
      subtitle="Students flagged for attendance, late submissions, or falling grades"
      actions={<>
        <button style={{ ...btn("primary"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={sendRiskAlerts} disabled={alertSending}>
          {alertSending ? "Sending..." : <><Mail size={13} /> Send Alert Emails</>}
        </button>
        <button style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={recalcAllRisk}><RefreshCw size={13} /> Recalc All</button>
        <button style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={loadRisk}><RotateCcw size={13} /> Refresh</button>
      </>}
    >
      {loading && <Spinner />}

      {!loading && alertMsg && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, marginBottom: 14,
          fontSize: "0.85rem", fontWeight: 600,
          background: alertMsg.startsWith("✅") ? "#DCFCE7" : "#FEE2E2",
          color:      alertMsg.startsWith("✅") ? "#166534" : "#991B1B",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {alertMsg.startsWith("✅") ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {alertMsg.replace(/^[✅❌]\s*/, "")}
        </div>
      )}

      {!loading && (
        riskStudents.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "#9CA3AF", padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={24} /> No at-risk students detected.
          </div>
        ) : (
          riskStudents.map((s, i) => {
            const r  = s?.risk || {};
            const rm = RISK_META[r.risk_level] || RISK_META.low;
            return (
              <div key={s.id || i} style={{ ...card, borderLeft: `4px solid ${rm.dot}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Avatar name={s.full_name} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{s.full_name}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{s.email}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge text={rm.label} bg={rm.bg} color={rm.color} />
                    <button
                      style={{ ...btn("ghost"), padding: "4px 12px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => recalcRisk(s.id)}
                    ><RefreshCw size={11} /> Recalc</button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>ATTENDANCE</div>
                    <div style={{ fontWeight: 700, color: r.attendance_score < 70 ? "#DC2626" : "#16A34A" }}>
                      {r.attendance_score ?? "N/A"}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>LATE SUBMISSIONS</div>
                    <div style={{ fontWeight: 700, color: r.late_submission_count >= 3 ? "#DC2626" : "#2D2D2D" }}>
                      {r.late_submission_count ?? 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>GRADE TREND</div>
                    <div style={{ fontWeight: 700, color: TREND_COLOR[r.grade_trend] || "#6B7280" }}>
                      {TREND_ICON[r.grade_trend] || "→"} {r.grade_trend || "stable"}
                    </div>
                  </div>
                  {r.predicted_grade != null && (
                    <div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>PREDICTED GRADE</div>
                      <div style={{ fontWeight: 700 }}>{r.predicted_grade}%</div>
                    </div>
                  )}
                </div>

                {r.flags?.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r.flags.map(f => (
                      <Badge key={f} text={f.replace(/_/g, " ")} bg="#FEE2E2" color="#991B1B" />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )
      )}
    </AdminPage>
  );
}
