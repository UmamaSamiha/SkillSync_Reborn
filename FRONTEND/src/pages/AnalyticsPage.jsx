import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

// ── Tiny bar chart ────────────────────────────────────────────────
function TrendChart({ data = [] }) {
  if (!data.length) return (
    <div style={{ textAlign: "center", color: "#9CA3AF", padding: "32px 0", fontSize: "0.88rem" }}>
      No grade data yet
    </div>
  );

  const max = Math.max(...data.map(d => d.percentage), 1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "0 4px" }}>
        {data.map((d, i) => {
          const h = Math.max(4, (d.percentage / max) * 116);
          const color = d.percentage >= 70 ? "#893941" : d.percentage >= 50 ? "#CB7885" : "#FCA5A5";
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 9, color: "#9CA3AF" }}>{Math.round(d.percentage)}%</div>
              <div
                title={`${d.percentage.toFixed(1)}% — ${new Date(d.date).toLocaleDateString()}`}
                style={{
                  width: "100%", height: `${h}px`, minHeight: 4,
                  background: color, borderRadius: "4px 4px 0 0",
                  transition: "height 0.4s ease",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, padding: "6px 4px 0", borderTop: "1px solid #F3F4F6" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#9CA3AF" }}>
            #{i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
// ── Badge ─────────────────────────────────────────────────────────
function Badge({ text, bg, color }) {
  return (
    <span style={{
      background: bg, color, fontSize: 11, fontWeight: 600,
      padding: "3px 10px", borderRadius: 999,
    }}>{text}</span>
  );
}

const TREND_COLOR = { rising: "#16A34A", falling: "#DC2626", stable: "#6B7280" };
const TREND_ICON  = { rising: "↑", falling: "↓", stable: "→" };

const CLASS_META = {
  "Consistent Performer": { bg: "#D4D994", color: "#5E6623" },
  "Improving":            { bg: "#DBEAFE", color: "#1E40AF" },
  "Declining":            { bg: "#FEF3C7", color: "#92400E" },
  "At-Risk":              { bg: "#FEE2E2", color: "#991B1B" },
  "Average":              { bg: "#F3F4F6", color: "#374151" },
};

// ═══════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const { user } = useAuth();

  const [performance, setPerformance] = useState(null);
  const [prediction,  setPrediction]  = useState(null);
  const [feedback,    setFeedback]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [fbLoading,   setFbLoading]   = useState(false);
  const [error,       setError]       = useState("");

  useEffect(() => {
    if (user?.id) loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [perfRes, predRes] = await Promise.all([
        api.get(`/analytics/performance/${user.id}`),
        api.get(`/analytics/grade-prediction/${user.id}`),
      ]);

      setPerformance(perfRes?.data?.data || null);
      setPrediction(predRes?.data?.data  || null);
    } catch (e) {
      setError("Could not load analytics data.");
    }
    setLoading(false);
  }

  async function loadFeedback() {
    if (feedback) return;
    setFbLoading(true);
    try {
      const res = await api.get(`/admin/personalized-feedback/${user.id}`);
      setFeedback(res?.data?.data || null);
    } catch {
      setFeedback({ error: "Could not load feedback." });
    }
    setFbLoading(false);
  }

  // ── Styles ────────────────────────────────────────────────────────
  const card = {
    background: "#fff",
    border: "1px solid rgba(137,57,65,0.1)",
    borderRadius: 16,
    padding: "20px 24px",
    marginBottom: 18,
  };

  const s = {
    page: {
      padding: "32px 28px",
      maxWidth: 760,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: "#2D2D2D",
    },
    title: {
      margin: 0,
      fontSize: "1.5rem",
      fontFamily: "Georgia, serif",
      color: "#893941",
    },
    sub: {
      margin: "4px 0 24px",
      fontSize: "0.88rem",
      color: "#7A7063",
    },
    sectionTitle: {
      fontSize: "0.8rem",
      fontWeight: 700,
      color: "#9CA3AF",
      letterSpacing: "0.05em",
      marginBottom: 14,
    },
  };

  if (loading) return (
    <div style={s.page}>
      <p style={{ color: "#9CA3AF" }}>Loading analytics...</p>
    </div>
  );

  if (error) return (
    <div style={s.page}>
      <p style={{ color: "#DC2626" }}>{error}</p>
    </div>
  );

  const trendDir = performance?.trend_direction || "stable";
  const cm       = CLASS_META[feedback?.classification] || CLASS_META["Average"];

  return (
    <div style={s.page}>
      <h2 style={s.title}>📈 My Analytics</h2>
      <p style={s.sub}>Your performance trends, grade prediction, and personalized feedback</p>

      {/* ── Performance Trend Graph ── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={s.sectionTitle}>GRADE TREND</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: TREND_COLOR[trendDir] }}>
            {TREND_ICON[trendDir]} {trendDir}
          </span>
        </div>

        <TrendChart data={performance?.trend || []} />

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          {[
            { color: "#893941", label: "≥ 70%" },
            { color: "#CB7885", label: "50–69%" },
            { color: "#FCA5A5", label: "< 50%" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Grade Prediction ── */}
      {prediction && (
        <div style={card}>
          <div style={s.sectionTitle}>FINAL GRADE PREDICTION</div>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "2.2rem", fontWeight: 700, color: "#893941", fontFamily: "Georgia, serif" }}>
                {prediction.predicted_grade != null ? `${prediction.predicted_grade}%` : "—"}
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                {prediction.letter_grade && (
                  <Badge text={`Letter Grade: ${prediction.letter_grade}`} bg="#D4D994" color="#5E6623" />
                )}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#7A7063", lineHeight: 1.6 }}>
                Based on your last <b>{prediction.data_points}</b> submissions using linear trend analysis.
                Confidence:{" "}
                <b style={{ color: prediction.confidence === "high" ? "#16A34A" : prediction.confidence === "medium" ? "#C17B3A" : "#DC2626" }}>
                  {prediction.confidence}
                </b>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>Current average</div>
                <div style={{ height: 6, background: "#F3F4F6", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${prediction.current_average || 0}%`,
                    background: "#893941",
                    borderRadius: 999,
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>
                  {prediction.current_average}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Personalized Feedback ── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={s.sectionTitle}>PERSONALIZED FEEDBACK</div>
          {!feedback && (
            <button
              onClick={loadFeedback}
              disabled={fbLoading}
              style={{
                padding: "6px 16px",
                background: "#893941", color: "#fff",
                border: "none", borderRadius: 8,
                fontSize: "0.8rem", fontWeight: 600,
                cursor: fbLoading ? "not-allowed" : "pointer",
                opacity: fbLoading ? 0.7 : 1,
              }}
            >
              {fbLoading ? "Loading..." : "Get Feedback"}
            </button>
          )}
        </div>

        {!feedback && !fbLoading && (
          <div style={{ textAlign: "center", color: "#9CA3AF", padding: "20px 0", fontSize: "0.88rem" }}>
            Click "Get Feedback" to see your personalized recommendations
          </div>
        )}

        {feedback && !feedback.error && (
          <div>
            {/* Classification badge */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <Badge text={feedback.classification} bg={cm.bg} color={cm.color} />
              <Badge text={`Avg: ${feedback.avg_grade}%`} bg="#F3F4F6" color="#374151" />
            </div>

            {/* Message */}
            <div style={{
              background: "#FDFAF7",
              border: "1px solid rgba(137,57,65,0.1)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 14,
              fontSize: "0.9rem",
              color: "#374151",
              lineHeight: 1.6,
            }}>
              {feedback.feedback?.message}
            </div>

            {/* Actions */}
            <div style={s.sectionTitle}>RECOMMENDED ACTIONS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {feedback.feedback?.actions?.map((a, i) => (
                <div key={i} style={{
                  background: "#EDE9FE", color: "#5B21B6",
                  fontSize: 12, fontWeight: 500,
                  padding: "5px 12px", borderRadius: 8,
                }}>
                  → {a}
                </div>
              ))}
            </div>

            {/* Flags */}
            {feedback.flags?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={s.sectionTitle}>DETECTED ISSUES</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {feedback.flags.map(f => (
                    <Badge key={f} text={f.replace(/_/g, " ")} bg="#FEE2E2" color="#991B1B" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {feedback?.error && (
          <p style={{ color: "#DC2626", fontSize: "0.88rem" }}>{feedback.error}</p>
        )}
      </div>

    </div>
  );
}
