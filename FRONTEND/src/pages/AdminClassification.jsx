import { useState, useEffect, useCallback } from "react";
import {
  Target, RotateCcw, MessageCircle, Star, TrendingUp, TrendingDown,
  AlertTriangle, BarChart3,
} from "lucide-react";
import api from "../utils/api";
import {
  safeData, Spinner, Badge, Avatar, RISK_META, TREND_ICON, TREND_COLOR,
  card, btn, AdminPage,
} from "../components/admin/adminShared";

const CLASS_META = {
  "Consistent Performer": { bg: "#D4D994", color: "#5E6623", icon: Star },
  "Improving":            { bg: "#DBEAFE", color: "#1E40AF", icon: TrendingUp },
  "Declining":            { bg: "#FEF3C7", color: "#92400E", icon: TrendingDown },
  "At-Risk":              { bg: "#FEE2E2", color: "#991B1B", icon: AlertTriangle },
  "Average":              { bg: "#F3F4F6", color: "#374151", icon: BarChart3 },
};

export default function AdminClassification() {
  const [classified, setClassified] = useState([]);
  const [loading,     setLoading]   = useState(false);
  const [feedback,    setFeedback]  = useState({});
  const [expandedFeedback, setExpandedFeedback] = useState(null);

  const loadClassification = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await api.get("/admin/student-classification");
      setClassified(safeData(res, []));
    } catch {
      setClassified([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadClassification(); }, [loadClassification]);

  const loadFeedback = async (userId) => {
    if (feedback[userId]) {
      setExpandedFeedback(expandedFeedback === userId ? null : userId);
      return;
    }
    try {
      const res = await api.get(`/admin/personalized-feedback/${userId}`);
      const data = res.data?.data || null;
      setFeedback(prev => ({ ...prev, [userId]: data }));
      setExpandedFeedback(userId);
    } catch (e) {
      alert("Failed to load feedback");
    }
  };

  return (
    <AdminPage
      title="Student Classification"
      icon={<Target size={20} style={{ marginRight: -2 }} />}
      subtitle="Consistent performers, improving, declining, and at-risk students"
      actions={<button style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={loadClassification}><RotateCcw size={13} /> Refresh</button>}
    >
      {loading && <Spinner />}

      {!loading && (
        classified.length === 0 ? (
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
                    <Badge text={<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><cm.icon size={11} /> {s?.classification}</span>} bg={cm.bg} color={cm.color} />
                    <Badge
                      text={`${TREND_ICON[s?.grade_trend] || "→"} ${s?.grade_trend || "stable"}`}
                      bg="#F3F4F6"
                      color={TREND_COLOR[s?.grade_trend] || "#6B7280"}
                    />
                    <button
                      style={{ ...btn("ghost"), padding: "4px 12px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => loadFeedback(s?.user?.id)}
                    >
                      {expanded ? "▲ Hide Feedback" : <><MessageCircle size={12} /> Feedback</>}
                    </button>
                  </div>
                </div>

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

                {expanded && fb && (
                  <div style={{
                    marginTop: 14, background: "#F9F5FF",
                    border: "1px solid rgba(137,57,65,0.15)",
                    borderRadius: 12, padding: "14px 18px",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: "#893941", display: "flex", alignItems: "center", gap: 6 }}>
                      <MessageCircle size={14} /> Personalized Feedback
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
        )
      )}
    </AdminPage>
  );
}
