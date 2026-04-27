import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, Tooltip, Legend,
} from "chart.js";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const STATUS_BADGE = {
  completed:   { color: "#5E6623", bg: "#D4D994", label: "Completed"   },
  interrupted: { color: "#893941", bg: "#F5D0D3", label: "Interrupted" },
  in_progress: { color: "#4A6B8A", bg: "#D0E4F5", label: "Active"      },
};

export default function HistoryPage() {
  const { user } = useAuth();
  const location = useLocation();

  const [sessions,  setSessions]  = useState([]);
  const [stats,     setStats]     = useState(null);
  const [weekly,    setWeekly]    = useState([]);
  const [filter,    setFilter]    = useState("all");
  const [sortField, setSortField] = useState("started_at");
  const [sortDir,   setSortDir]   = useState("desc");
  const [loading,   setLoading]   = useState(true);

  // Re-fetches every time the user navigates to this page
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);

    Promise.all([
      api.get("/focus/history?per_page=100"),
      api.get("/focus/stats"),
      api.get(`/analytics/weekly-productivity/${user.id}`),
    ])
      .then(([histRes, statsRes, weeklyRes]) => {
        setSessions(histRes.data?.data?.items || []);
        setStats(statsRes.data?.data          || null);
        setWeekly(weeklyRes.data?.data?.days  || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, location.key]);

  // ── Filter + sort ──────────────────────────────────────────────
  const visible = sessions
    .filter(s => filter === "all" || s.status === filter)
    .slice()
    .sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (sortField === "duration_minutes" || sortField === "sessions_count") {
        av = Number(av); bv = Number(bv);
      }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const handleSort = field => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const sortIcon = field =>
    sortField !== field ? " ↕" : sortDir === "asc" ? " ↑" : " ↓";

  // ── Chart ──────────────────────────────────────────────────────
  const chartData = {
    labels: weekly.map(d => d.day),
    datasets: [{
      label:           "Focus Hours",
      data:            weekly.map(d => d.hours),
      backgroundColor: weekly.map(d => d.hours >= 3 ? "#893941" : "#A8AF4A"),
      borderRadius:    6,
      borderSkipped:   false,
    }],
  };

  const chartOptions = {
    responsive:          true,
    maintainAspectRatio: false,
    plugins: {
      legend:  { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.raw}h` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#7A7063", font: { size: 11 } } },
      y: { grid: { color: "rgba(0,0,0,0.06)" }, ticks: { color: "#7A7063", font: { size: 11 } }, beginAtZero: true },
    },
  };

  // ── Derived stats ──────────────────────────────────────────────
  const totalMins     = sessions.filter(s => s.status === "completed").reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const totalH        = Math.floor(totalMins / 60);
  const totalM        = totalMins % 60;
  const totalLabel    = `${totalH}h ${String(totalM).padStart(2, "0")}m`;
  const sessCompleted = stats?.sessions_completed ?? sessions.reduce((a, s) => a + (s.sessions_count || 1), 0);

  if (loading) {
    return (
      <div style={{ textAlign: "center", color: "#7A7063", padding: "60px 0" }}>
        Loading session history…
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 4, fontFamily: "'Playfair Display',serif" }}>
        My Session History
      </h2>
      <p style={{ color: "#7A7063", fontSize: "0.88rem", marginBottom: 24 }}>
        Track your productivity and focus patterns
      </p>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { icon: "🕐", value: totalLabel,    label: "Total Focus Time",   color: "#893941" },
          { icon: "✅", value: sessCompleted, label: "Sessions Completed", color: "#5E6623" },
          { icon: "🔥", value: `${stats?.total_sessions ?? sessions.length} sessions`, label: "All Time Sessions", color: "#C17B3A" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)",
            borderRadius: 16, padding: "20px 24px",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(137,57,65,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.8rem", color: "#7A7063", marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {weekly.length > 0 && (
        <div style={{ background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h4 style={{ marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }}>Daily Focus Hours This Week</h4>
          <div style={{ height: 200 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Session table */}
      <div style={{ background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)", borderRadius: 16, padding: 24 }}>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["all", "completed", "interrupted"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding:       "4px 14px",
                borderRadius:  999,
                fontSize:      "0.75rem",
                fontWeight:    600,
                cursor:        "pointer",
                fontFamily:    "inherit",
                border:        `1.5px solid ${filter === f ? "#893941" : "rgba(45,45,45,0.15)"}`,
                background:    filter === f ? "#893941" : "transparent",
                color:         filter === f ? "#fff" : "#7A7063",
                transition:    "all 0.15s",
                textTransform: "capitalize",
              }}>
              {f === "all" ? "All" : STATUS_BADGE[f]?.label ?? f}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "#7A7063", alignSelf: "center" }}>
            {visible.length} session{visible.length !== 1 ? "s" : ""}
          </span>
        </div>

        {visible.length === 0 ? (
          <p style={{ textAlign: "center", color: "#7A7063", padding: "32px 0", fontSize: "0.88rem" }}>
            No sessions yet — start a focus session and it will appear here.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  { label: "Date",     field: "started_at"       },
                  { label: "Topic",    field: "topic_label"      },
                  { label: "Duration", field: "duration_minutes" },
                  { label: "Sessions", field: "sessions_count"   },
                  { label: "Status",   field: "status"           },
                ].map(({ label, field }) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    style={{
                      textAlign: "left", padding: "10px 14px",
                      fontSize: "0.75rem", fontWeight: 600,
                      color: "#7A7063", textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid rgba(45,45,45,0.1)",
                      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                    }}>
                    {label}{sortIcon(field)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((s, idx) => {
                const badge = STATUS_BADGE[s.status] || STATUS_BADGE.completed;
                const date  = new Date(s.started_at).toLocaleDateString("en", {
                  month: "short", day: "numeric", year: "numeric",
                });
                return (
                  <tr key={s.id} style={{ background: idx % 2 === 0 ? "#fff" : "#FAF7F2" }}>
                    <td style={{ padding: "12px 14px", fontSize: "0.875rem", color: "#7A7063",    borderBottom: "1px solid rgba(45,45,45,0.06)" }}>{date}</td>
                    <td style={{ padding: "12px 14px", fontSize: "0.875rem", fontWeight: 500,     borderBottom: "1px solid rgba(45,45,45,0.06)" }}>{s.topic_label}</td>
                    <td style={{ padding: "12px 14px", fontSize: "0.875rem",                      borderBottom: "1px solid rgba(45,45,45,0.06)" }}>{s.duration_minutes} min</td>
                    <td style={{ padding: "12px 14px", fontSize: "0.875rem", textAlign: "center", borderBottom: "1px solid rgba(45,45,45,0.06)" }}>{s.sessions_count}</td>
                    <td style={{ padding: "12px 14px",                                            borderBottom: "1px solid rgba(45,45,45,0.06)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}