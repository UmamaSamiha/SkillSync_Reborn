import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

// ── Helpers ────────────────────────────────────────────────────────
function getInitials(name = "") {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function safeData(res, fallback = []) {
  return res?.data?.data ?? fallback;
}

// ── Static maps ───────────────────────────────────────────────────
const RISK_META = {
  high:   { label: "High Risk",   bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  medium: { label: "Medium Risk", bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B" },
  low:    { label: "Low Risk",    bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
};

const CLASS_META = {
  "Consistent Performer": { bg: "#D4D994", color: "#5E6623", icon: "⭐" },
  "Improving":            { bg: "#DBEAFE", color: "#1E40AF", icon: "📈" },
  "Declining":            { bg: "#FEF3C7", color: "#92400E", icon: "📉" },
  "At-Risk":              { bg: "#FEE2E2", color: "#991B1B", icon: "⚠️" },
  "Average":              { bg: "#F3F4F6", color: "#374151", icon: "📊" },
};

const TREND_ICON = { rising: "↑", falling: "↓", stable: "→" };
const TREND_COLOR = { rising: "#16A34A", falling: "#DC2626", stable: "#6B7280" };

// ── Tiny bar chart for grade trend ────────────────────────────────
function TrendBar({ data = [] }) {
  if (!data.length) return <span style={{ color: "#9CA3AF", fontSize: 12 }}>No data</span>;
  const max = Math.max(...data.map(d => d.percentage), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 32 }}>
      {data.slice(-10).map((d, i) => (
        <div
          key={i}
          title={`${d.percentage.toFixed(1)}%`}
          style={{
            width: 6,
            height: `${(d.percentage / max) * 100}%`,
            minHeight: 2,
            background: d.percentage >= 70 ? "#893941" : d.percentage >= 50 ? "#CB7885" : "#FCA5A5",
            borderRadius: 2,
            transition: "height 0.3s",
          }}
        />
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────
function StatCard({ label, value, icon, color = "#893941" }) {
  return (
    <div style={{
      background: "#FDFAF7",
      border: "1px solid rgba(137,57,65,0.15)",
      borderRadius: 14,
      padding: "18px 22px",
      flex: 1,
      minWidth: 130,
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "Georgia, serif" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 12, color: "#7A7063", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────
function Badge({ text, bg, color }) {
  return (
    <span style={{
      background: bg, color, fontSize: 11, fontWeight: 700,
      padding: "2px 10px", borderRadius: 999, display: "inline-block",
    }}>{text}</span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }) {
  const colors = ["#893941","#CB7885","#5E6623","#7A5C8A","#C17B3A"];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{
        width: 32, height: 32, border: "3px solid #F3F4F6",
        borderTop: "3px solid #893941", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const { user } = useAuth();

  const [tab, setTab]                   = useState("overview");
  const [loading, setLoading]           = useState(false);
  const [overview, setOverview]         = useState(null);
  const [riskStudents, setRiskStudents] = useState([]);
  const [classified, setClassified]     = useState([]);
  const [performance, setPerformance]   = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [feedback, setFeedback]         = useState({});       // { userId: feedbackObj }
  const [certMsg, setCertMsg]           = useState("");
  const [verifyCode, setVerifyCode]     = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [certLoading, setCertLoading]   = useState({});       // { userId: bool }
  const [expandedFeedback, setExpandedFeedback] = useState(null);
  const [alertSending, setAlertSending]         = useState(false);
  const [alertMsg, setAlertMsg]                 = useState("");

  // ── Loaders ─────────────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/overview");
      setOverview(safeData(res, null));
    } catch { setOverview(null); }
    setLoading(false);
  }, []);

  const loadRisk = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/risk-alerts");
      setRiskStudents(safeData(res, []));
    } catch { setRiskStudents([]); }
    setLoading(false);
  }, []);

  const loadClassification = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await api.get("/admin/student-classification");
      const data = safeData(res, []);
      setClassified(data);

      // Load performance in parallel
      const perfs = await Promise.all(
        data.map(s =>
          api.get(`/analytics/performance/${s?.user?.id}`)
            .then(r => ({
              ...safeData(r, {}),
              name:    s?.user?.full_name || "Unknown",
              id:      s?.user?.id,
              email:   s?.user?.email,
              avg_grade:      s?.avg_grade,
              classification: s?.classification,
              risk_level:     s?.risk_level,
              study_hours:    s?.study_hours,
              predicted_grade: s?.predicted_grade,
            }))
            .catch(() => ({
              name: s?.user?.full_name || "Unknown",
              id:   s?.user?.id,
              email: s?.user?.email,
              trend: [], average: 0, trend_direction: "stable", total_submissions: 0,
              avg_grade: s?.avg_grade, classification: s?.classification,
              risk_level: s?.risk_level, study_hours: s?.study_hours,
              predicted_grade: s?.predicted_grade,
            }))
        )
      );
      setPerformance(perfs);
    } catch {
      setClassified([]);
      setPerformance([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  // ── Tab switch loader ────────────────────────────────────────────
  const handleTab = (t) => {
    setTab(t);
    if (t === "risk") loadRisk();
    if (t === "classification" || t === "performance") loadClassification();
  };

  // ── Recalculate risk for one student ────────────────────────────
  const recalcRisk = async (userId) => {
    try {
      await api.post(`/admin/recalculate-risk/${userId}`);
      loadRisk();
    } catch (e) {
      alert("Recalculation failed: " + (e?.response?.data?.error || e.message));
    }
  };

  // ── Recalculate all risk ─────────────────────────────────────────
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

  // ── Send risk alert emails ───────────────────────────────────────
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

  // ── Load personalized feedback ───────────────────────────────────
  const loadFeedback = async (userId) => {
    if (feedback[userId]) {
      setExpandedFeedback(expandedFeedback === userId ? null : userId);
      return;
    }
    try {
      const res = await api.get(`/admin/personalized-feedback/${userId}`);
      const data = safeData(res, null);
      setFeedback(prev => ({ ...prev, [userId]: data }));
      setExpandedFeedback(userId);
    } catch (e) {
      alert("Failed to load feedback");
    }
  };

  // ── Generate certificate for one student ─────────────────────────
  const generateCert = async (studentId, studentName) => {
    setCertLoading(prev => ({ ...prev, [studentId]: true }));
    setCertMsg("");
    try {
      const res  = await api.post("/certificates/generate", {
        user_id: studentId,
        title:   "Certificate of Achievement — SkillSync LMS",
      });
      const cert = safeData(res, null);
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
    if (!classified.length) await loadClassification();
    setCertMsg("Generating for all students...");
    setCertificates([]);
    for (const s of classified) {
      await generateCert(s?.user?.id, s?.user?.full_name);
    }
    setCertMsg(`✅ Done! Generated ${classified.length} certificates.`);
  };

  // ── Verify certificate ───────────────────────────────────────────
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

  // ── Styles ───────────────────────────────────────────────────────
  const card = {
    background: "#FDFAF7",
    border: "1px solid rgba(137,57,65,0.12)",
    borderRadius: 16,
    padding: "18px 22px",
    marginBottom: 14,
  };

  const tabBtn = (t) => ({
    padding: "7px 18px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontSize: "0.82rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    transition: "all 0.2s",
    background: tab === t ? "#893941" : "#F5F0EB",
    color:      tab === t ? "#fff"    : "#7A7063",
  });

  const btn = (variant = "primary") => ({
    padding: "8px 18px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontSize: "0.82rem",
    fontWeight: 700,
    background: variant === "primary" ? "#893941" : variant === "ghost" ? "transparent" : "#F5F0EB",
    color:      variant === "primary" ? "#fff"    : "#893941",
    border:     variant === "ghost" ? "1px solid #893941" : "none",
  });

  const inputStyle = {
    padding: "9px 14px",
    borderRadius: 10,
    border: "1.5px solid rgba(137,57,65,0.2)",
    background: "#FDFAF7",
    fontSize: "0.9rem",
    outline: "none",
    width: 260,
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#2D2D2D", maxWidth: 960, margin: "0 auto" }}>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: "1.6rem", fontFamily: "Georgia, serif", color: "#893941" }}>
          Admin Dashboard
        </h2>
        <p style={{ margin: "4px 0 0", color: "#7A7063", fontSize: "0.9rem" }}>
          Welcome back, <b>{user?.full_name}</b>
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          ["overview",       "📊 Overview"],
          ["risk",           "⚠️ Risk Detection"],
          ["classification", "🎯 Classification"],
          ["performance",    "📈 Performance"],
          ["certificates",   "🏆 Certificates"],
          ["verify",         "🔐 Verify"],
        ].map(([k, l]) => (
          <button key={k} style={tabBtn(k)} onClick={() => handleTab(k)}>{l}</button>
        ))}
      </div>

      {loading && <Spinner />}

      {/* ════════════════════════════════════════
          TAB: OVERVIEW
      ════════════════════════════════════════ */}
      {tab === "overview" && !loading && (
        <div>
          {overview ? (
            <div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
                <StatCard label="Total Students"  value={overview.total_students}  icon="👨‍🎓" color="#893941" />
                <StatCard label="Total Teachers"  value={overview.total_teachers}  icon="👩‍🏫" color="#5E6623" />
                <StatCard label="Flagged Submissions" value={overview.flagged_count}   icon="🚩" color="#C17B3A" />
                <StatCard label="High Risk Students"  value={overview.high_risk_count} icon="⚠️" color="#DC2626" />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button style={btn("ghost")} onClick={recalcAllRisk}>🔄 Recalculate All Risk</button>
                <button style={btn("ghost")} onClick={loadOverview}>↺ Refresh</button>
              </div>
            </div>
          ) : (
            <p style={{ color: "#9CA3AF" }}>Could not load overview. Check backend connection.</p>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: RISK DETECTION
      ════════════════════════════════════════ */}
      {tab === "risk" && !loading && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#893941" }}>⚠️ At-Risk Students</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn("primary")} onClick={sendRiskAlerts} disabled={alertSending}>
                {alertSending ? "Sending..." : "📧 Send Alert Emails"}
              </button>
              <button style={btn("ghost")} onClick={recalcAllRisk}>🔄 Recalc All</button>
              <button style={btn("ghost")} onClick={loadRisk}>↺ Refresh</button>
            </div>
          </div>

          {alertMsg && (
            <div style={{
              padding: "10px 16px", borderRadius: 10, marginBottom: 14,
              fontSize: "0.85rem", fontWeight: 600,
              background: alertMsg.startsWith("✅") ? "#DCFCE7" : "#FEE2E2",
              color:      alertMsg.startsWith("✅") ? "#166534" : "#991B1B",
            }}>
              {alertMsg}
            </div>
          )}

          {riskStudents.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#9CA3AF", padding: 40 }}>
              ✅ No at-risk students detected.
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
                        style={{ ...btn("ghost"), padding: "4px 12px", fontSize: "0.75rem" }}
                        onClick={() => recalcRisk(s.id)}
                      >🔄 Recalc</button>
                    </div>
                  </div>

                  {/* Risk details */}
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

                  {/* Flags */}
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
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: CLASSIFICATION
      ════════════════════════════════════════ */}
      {tab === "classification" && !loading && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#893941" }}>🎯 Student Classification</h3>
            <button style={btn("ghost")} onClick={loadClassification}>↺ Refresh</button>
          </div>

          {classified.length === 0 ? (
            <p style={{ color: "#9CA3AF" }}>No students found.</p>
          ) : (
            classified.map((s, i) => {
              const cm = CLASS_META[s?.classification] || CLASS_META["Average"];
              const fb = feedback[s?.user?.id];
              const expanded = expandedFeedback === s?.user?.id;

              return (
                <div key={s?.user?.id || i} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Avatar name={s?.user?.full_name} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{s?.user?.full_name}</div>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{s?.user?.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Badge text={`${cm.icon} ${s?.classification}`} bg={cm.bg} color={cm.color} />
                      <Badge
                        text={`${TREND_ICON[s?.grade_trend] || "→"} ${s?.grade_trend || "stable"}`}
                        bg="#F3F4F6"
                        color={TREND_COLOR[s?.grade_trend] || "#6B7280"}
                      />
                      <button
                        style={{ ...btn("ghost"), padding: "4px 12px", fontSize: "0.75rem" }}
                        onClick={() => loadFeedback(s?.user?.id)}
                      >
                        {expanded ? "▲ Hide Feedback" : "💬 Feedback"}
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
                    <div>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>AVG GRADE </span>
                      <b style={{ color: s?.avg_grade >= 70 ? "#16A34A" : s?.avg_grade >= 50 ? "#C17B3A" : "#DC2626" }}>
                        {s?.avg_grade ?? 0}%
                      </b>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>RISK </span>
                      <b style={{ color: RISK_META[s?.risk_level]?.dot || "#6B7280" }}>
                        {s?.risk_level?.toUpperCase() || "LOW"}
                      </b>
                    </div>
                    {s?.study_hours != null && (
                      <div>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>STUDY HOURS </span>
                        <b>{s.study_hours}h</b>
                      </div>
                    )}
                    {s?.predicted_grade != null && (
                      <div>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>PREDICTED </span>
                        <b>{s.predicted_grade}%</b>
                      </div>
                    )}
                  </div>

                  {/* Personalized feedback panel */}
                  {expanded && fb && (
                    <div style={{
                      marginTop: 14, background: "#F9F5FF",
                      border: "1px solid rgba(137,57,65,0.15)",
                      borderRadius: 12, padding: "14px 18px",
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 6, color: "#893941" }}>
                        💬 Personalized Feedback
                      </div>
                      <p style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>
                        {fb?.feedback?.message}
                      </p>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7A7063", marginBottom: 4 }}>
                        RECOMMENDED ACTIONS:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {fb?.feedback?.actions?.map((a, ai) => (
                          <Badge key={ai} text={`→ ${a}`} bg="#EDE9FE" color="#5B21B6" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Flags */}
                  {s?.flags?.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.flags.map(f => (
                        <Badge key={f} text={f.replace(/_/g, " ")} bg="#FEE2E2" color="#991B1B" />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: PERFORMANCE TRENDS
      ════════════════════════════════════════ */}
      {tab === "performance" && !loading && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#893941" }}>📈 Performance Trends & Grade Prediction</h3>
            <button style={btn("ghost")} onClick={loadClassification}>↺ Refresh</button>
          </div>

          {performance.length === 0 ? (
            <p style={{ color: "#9CA3AF" }}>No performance data found.</p>
          ) : (
            performance.map((p, i) => (
              <div key={p.id || i} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Avatar name={p.name} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{p.email}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Badge
                      text={`${TREND_ICON[p.trend_direction] || "→"} ${p.trend_direction || "stable"}`}
                      bg="#F3F4F6"
                      color={TREND_COLOR[p.trend_direction] || "#6B7280"}
                    />
                    {p.classification && (
                      <Badge
                        text={(CLASS_META[p.classification]?.icon || "") + " " + p.classification}
                        bg={CLASS_META[p.classification]?.bg || "#F3F4F6"}
                        color={CLASS_META[p.classification]?.color || "#374151"}
                      />
                    )}
                  </div>
                </div>

                {/* Grade trend bar */}
                <div style={{ marginTop: 14, display: "flex", gap: 24, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>GRADE TREND (last 10)</div>
                    <TrendBar data={p.trend || []} />
                  </div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>AVERAGE</div>
                      <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#893941" }}>
                        {p.average ?? p.avg_grade ?? 0}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>SUBMISSIONS</div>
                      <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{p.total_submissions ?? 0}</div>
                    </div>
                    {p.predicted_grade != null && (
                      <div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>PREDICTED</div>
                        <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#5E6623" }}>
                          {p.predicted_grade}%
                        </div>
                      </div>
                    )}
                    {p.study_hours != null && (
                      <div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>STUDY HRS</div>
                        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{p.study_hours}h</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: CERTIFICATES
      ════════════════════════════════════════ */}
      {tab === "certificates" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#893941" }}>🏆 Certificates</h3>
            <div style={{ display: "flex", gap: 8 }}>
              {!classified.length && (
                <button style={btn("ghost")} onClick={loadClassification}>Load Students</button>
              )}
              <button style={btn("primary")} onClick={generateAllCerts} disabled={loading}>
                🏆 Generate All
              </button>
            </div>
          </div>

          {certMsg && (
            <div style={{
              padding: "10px 16px", borderRadius: 10, marginBottom: 14,
              background: certMsg.startsWith("✅") ? "#DCFCE7" : certMsg.startsWith("❌") ? "#FEE2E2" : "#FEF3C7",
              color:      certMsg.startsWith("✅") ? "#166534" : certMsg.startsWith("❌") ? "#991B1B" : "#92400E",
              fontSize: "0.88rem", fontWeight: 600,
            }}>
              {certMsg}
            </div>
          )}

          {/* Per-student generate buttons */}
          {classified.length > 0 && (
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: "#7A7063", fontSize: "0.85rem" }}>
                GENERATE FOR INDIVIDUAL STUDENTS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {classified.map(s => (
                  <button
                    key={s?.user?.id}
                    style={{ ...btn("ghost"), fontSize: "0.78rem", padding: "5px 12px" }}
                    onClick={() => generateCert(s?.user?.id, s?.user?.full_name)}
                    disabled={certLoading[s?.user?.id]}
                  >
                    {certLoading[s?.user?.id] ? "⏳" : "🏅"} {s?.user?.full_name?.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generated certificates */}
          {certificates.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#7A7063", fontSize: "0.85rem" }}>
                GENERATED CERTIFICATES ({certificates.length})
              </div>
              {certificates.map((c, i) => (
                <div key={c.id || i} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ fontSize: 28 }}>🏆</div>
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
                        style={{ ...btn("ghost"), textDecoration: "none", padding: "5px 12px", fontSize: "0.78rem" }}
                      >
                        ⬇ Download PDF
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
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: VERIFY
      ════════════════════════════════════════ */}
      {tab === "verify" && (
        <div>
          <h3 style={{ margin: "0 0 16px", color: "#893941" }}>🔐 Verify Certificate</h3>
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
                  <div style={{ color: "#991B1B", fontWeight: 700 }}>
                    ❌ {verifyResult.error}
                  </div>
                ) : (
                  <div>
                    <div style={{ color: "#166534", fontWeight: 700, marginBottom: 8 }}>
                      ✅ Valid Certificate
                    </div>
                    <div style={{ fontSize: "0.88rem", color: "#2D2D2D" }}>
                      <div><b>Holder:</b> {verifyResult.holder?.full_name}</div>
                      <div><b>Title:</b> {verifyResult.title}</div>
                      {verifyResult.grade && <div><b>Grade:</b> {verifyResult.grade}</div>}
                      {verifyResult.study_hours != null && <div><b>Study Hours:</b> {verifyResult.study_hours}h</div>}
                      <div><b>Issued:</b> {verifyResult.issued_at ? new Date(verifyResult.issued_at).toLocaleDateString() : "—"}</div>
                      <div><b>Status:</b> {verifyResult.valid ? "✅ Active" : "❌ Revoked"}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
