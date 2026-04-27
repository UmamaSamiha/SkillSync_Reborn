import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";


// ── Helpers ────────────────────────────────────────────────────────
function getInitials(name = "") {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}


/**
 * Universal Data Extractor
 * Safely extracts an array from any API response format.
 */
const safeData = (response, fallback = []) => {
  // If the response is completely empty/undefined
  if (!response) return fallback;

  // Axios automatically wraps responses in a 'data' object. Let's unwrap it.
  const payload = response.data ? response.data : response;

  // Scenario 1: Backend sent a raw array -> [ {...}, {...} ]
  if (Array.isArray(payload)) return payload;

  // Scenario 2: Backend used the Universal Envelope -> { success: true, data: [ {...} ] }
  if (payload && Array.isArray(payload.data)) return payload.data;

  // Scenario 3: Backend used a custom key -> { submissions: [ {...} ] }
  const commonKeys = ['submissions', 'items', 'results'];
  for (let key of commonKeys) {
    if (payload && Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  // If we can't find an array anywhere, return the safe fallback to prevent crashes
  return fallback;
};

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

// ── helpers──────────────────────────────────────────────────

function engColor(score) {
  if (score >= 75) return "#16A34A";
  if (score >= 45) return "#C17B3A";
  return "#DC2626";
}
function engLabel(score) {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

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

function EngBar({ value = 0, color = "#893941", label = "" }) {
  return (
    <div style={{ flex: 1, minWidth: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 6, background: "#F3F4F6", borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: color, borderRadius: 99, transition: "width 0.4s" }} />
      </div>
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
  const [scanningId, setScanningId] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [engagementData, setEngagementData] = useState([]);
  const [engMsg, setEngMsg]                 = useState("");
  const [calcingAll, setCalcingAll]         = useState(false);
  const [calcingOne, setCalcingOne]         = useState(null);

  // ── Loaders ─────────────────────────────────────────────────────
  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      // Using your custom api utility! Change the URL if your Flask route is different.
      const res = await api.get("/admin/submissions");
      setSubmissions(safeData(res, []));
    } catch { 
      setSubmissions([]); 
    }
    setLoading(false);
  }, []);

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


  const loadEngagement = useCallback(async () => {
    setLoading(true);
    setEngMsg("");
    try {
      const res = await api.get("/analytics/engagement-all");
      setEngagementData(safeData(res, []));
    } catch {
      setEngagementData([]);
      setEngMsg("❌ Could not load engagement data.");
    }
    setLoading(false);
  }, []);

  const calcAllEngagement = async () => {
    setCalcingAll(true);
    setEngMsg("");
    try {
      const res  = await api.post("/analytics/engagement/calculate-all");
      const data = safeData(res, null);
      setEngMsg(`✅ Recalculated for ${data?.success_count ?? 0} students.`);
      await loadEngagement();
    } catch (e) {
      setEngMsg("❌ Failed: " + (e?.response?.data?.error || e.message));
    }
    setCalcingAll(false);
  };

  const calcOneEngagement = async (userId) => {
    setCalcingOne(userId);
    try {
      await api.post(`/analytics/engagement/calculate/${userId}`);
      await loadEngagement();
    } catch (e) {
      setEngMsg("❌ Failed: " + (e?.response?.data?.error || e.message));
    }
    setCalcingOne(null);
  };

  useEffect(() => {
    if (tab === "overview") {
      loadOverview();
    } else if (tab === "submissions") {
      loadSubmissions();
    } else if (tab === "risk-alerts") { // Adjust these string names to match your actual tab names
      loadRisk();
    } else if (tab === "classification") {
      loadClassification();
    }
  }, [tab, loadOverview, loadSubmissions, loadRisk, loadClassification]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  // ── Tab switch loader ────────────────────────────────────────────
  const handleTab = (t) => {
    setTab(t);
    if (t === "risk") loadRisk();
    if (t === "classification" || t === "performance") loadClassification();
    if (t === "submissions") loadSubmissions();
    if (t === "engagement") loadEngagement();
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

  const handleScan = async (submissionId) => {
    setScanningId(submissionId);
    try {
      const res = await api.post(`/admin/submissions/${submissionId}/analyze`);
      const data = res.data;

      if (data.success) {
        setSubmissions((prev) =>
          prev.map((sub) =>
            sub.id === submissionId
              ? {
                  ...sub,
                  ai_score:         data.data.ai_score,
                  similarity_score: data.data.similarity_score,
                  flagged:          data.data.flagged,
                  scan_reason:      data.data.reason,
                  scan_confidence:  data.data.confidence,
                }
              : sub
          )
        );
      } else {
        alert("Failed to complete AI scan.");
      }
    } catch (error) {
      console.error("Error during AI scan:", error);
      alert("An error occurred while scanning.");
    } finally {
      setScanningId(null);
    }
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
          ["submissions",    "📝 Submissions"],
          ["risk",           "⚠️ Risk Detection"],
          ["classification", "🎯 Classification"],
          ["performance",    "📈 Performance"],
          ["engagement",     "💡 Engagement"],
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
          TAB: SUBMISSIONS (AI SCANNER)
      ════════════════════════════════════════ */}
      {tab === "submissions" && !loading && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#893941" }}>📝 Student Submissions</h3>
            <button style={btn("ghost")} onClick={loadSubmissions}>↺ Refresh</button>
          </div>

          {submissions.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#9CA3AF", padding: 40 }}>
              No submissions found.
            </div>
          ) : (
            <div style={card}>
              <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #F5F0EB" }}>
                    <th style={{ padding: "12px 8px", color: "#7A7063", fontSize: "0.85rem" }}>STUDENT</th>
                    <th style={{ padding: "12px 8px", color: "#7A7063", fontSize: "0.85rem" }}>ASSIGNMENT</th>
                    <th style={{ padding: "12px 8px", color: "#7A7063", fontSize: "0.85rem" }}>AI SCORE</th>
                    <th style={{ padding: "12px 8px", color: "#7A7063", fontSize: "0.85rem" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} style={{ borderBottom: "1px solid #F5F0EB" }}>
                      <td style={{ padding: "12px 8px", fontWeight: 600 }}>{sub.student_name || "Unknown"}</td>
                      <td style={{ padding: "12px 8px" }}>{sub.assignment_title || sub.title || "Untitled"}</td>
                      <td style={{ padding: "12px 8px" }}>
                        {sub.ai_score !== undefined && sub.ai_score !== null ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <Badge
                              text={`🤖 AI: ${sub.ai_score}%`}
                              bg={sub.ai_score > 60 ? "#FEE2E2" : "#DCFCE7"}
                              color={sub.ai_score > 60 ? "#991B1B" : "#166534"}
                            />
                            {sub.similarity_score > 0 && (
                              <Badge
                                text={`🔁 Similar: ${sub.similarity_score}%`}
                                bg={sub.similarity_score > 50 ? "#FEF3C7" : "#F3F4F6"}
                                color={sub.similarity_score > 50 ? "#92400E" : "#6B7280"}
                              />
                            )}
                            {sub.scan_reason && (
                              <span style={{ fontSize: 10, color: "#9CA3AF", fontStyle: "italic" }}>
                                {sub.scan_reason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.85rem", color: "#9CA3AF" }}>Not Scanned</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <button
                          onClick={() => handleScan(sub.id)}
                          disabled={scanningId === sub.id}
                          style={{
                            ...btn(scanningId === sub.id ? "ghost" : "primary"),
                            padding: "6px 14px",
                            opacity: scanningId === sub.id ? 0.6 : 1
                          }}
                        >
                          {scanningId === sub.id ? "Scanning..." : "Analyze"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          TAB: ENGAGEMENT
      ════════════════════════════════════════ */}
      {tab === "engagement" && !loading && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: "#893941" }}>💡 Engagement Scores</h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#9CA3AF" }}>
                Current week · Forum 25% · Submissions 35% · Resources 20% · Quiz 20%
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn("primary")} onClick={calcAllEngagement} disabled={calcingAll}>
                {calcingAll ? "Calculating..." : "🔄 Recalculate All"}
              </button>
              <button style={btn("ghost")} onClick={loadEngagement}>↺ Refresh</button>
            </div>
          </div>

          {engMsg && (
            <div style={{
              padding: "10px 16px", borderRadius: 10, marginBottom: 14,
              fontSize: "0.85rem", fontWeight: 600,
              background: engMsg.startsWith("✅") ? "#DCFCE7" : "#FEE2E2",
              color:      engMsg.startsWith("✅") ? "#166534" : "#991B1B",
            }}>
              {engMsg}
            </div>
          )}

          {engagementData.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#9CA3AF", padding: 40 }}>
              No engagement data yet.{" "}
              <button style={{ ...btn("ghost"), marginLeft: 8 }} onClick={calcAllEngagement}>
                Calculate Now
              </button>
            </div>
          ) : (
            engagementData.map((item, i) => {
              const s      = item?.score ?? {};
              const total  = s.total_score ?? 0;
              const color  = engColor(total);
              const isCalc = calcingOne === item?.user?.id;
              return (
                <div key={item?.user?.id || i} style={{ ...card, borderLeft: `4px solid ${color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Avatar name={item?.user?.full_name} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{item?.user?.full_name}</div>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{item?.user?.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{
                        background: color + "22", border: `1.5px solid ${color}`,
                        borderRadius: 999, padding: "4px 14px",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color }}>{total}</span>
                        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{engLabel(total)}</span>
                      </div>
                      <button
                        style={{ ...btn("ghost"), padding: "4px 12px", fontSize: "0.75rem", opacity: isCalc ? 0.6 : 1 }}
                        onClick={() => calcOneEngagement(item?.user?.id)}
                        disabled={isCalc}
                      >
                        {isCalc ? "⏳" : "🔄"}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <EngBar value={s.forum_score      ?? 0} color="#7A5C8A" label="Forum"       />
                    <EngBar value={s.submission_score ?? 0} color="#893941" label="Submissions" />
                    <EngBar value={s.resource_score   ?? 0} color="#C17B3A" label="Resources"   />
                    <EngBar value={s.quiz_score        ?? 0} color="#5E6623" label="Quiz"        />
                  </div>
                  {s.week_start && (
                    <div style={{ marginTop: 10, fontSize: 11, color: "#9CA3AF" }}>
                      Week of {s.week_start}
                    </div>
                  )}
                </div>
              );
            })
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
