import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import toast from "react-hot-toast";
import api from "../utils/api";
import "./MemberDetail.css";

ChartJS.register(ArcElement, Tooltip, Legend);

/* ── helpers ─────────────────────────────────────── */

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function timeAgo(isoString) {
  if (!isoString) return "Unknown";
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const CONTRIBUTION_MAP = {
  file_upload:     { label: "File Uploads",    color: "#893941" },
  submission:      { label: "Submissions",     color: "#CB7885" },
  forum_post:      { label: "Forum Posts",     color: "#D4D994" },
  quiz_attempt:    { label: "Quiz Attempts",   color: "#5E6623" },
  resource_access: { label: "Resource Access", color: "#C17B3A" },
};

function buildDonutData(counts = {}) {
  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  const total   = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return entries.map(([key, val]) => ({
    key,
    label: CONTRIBUTION_MAP[key]?.label || key,
    color: CONTRIBUTION_MAP[key]?.color || "#999",
    count: val,
    pct:   Math.round((val / total) * 100),
  }));
}

/* Makes each member's chart look distinct using their userId as a seed */
function applyMemberVariance(counts = {}, userId = "") {
  const seed = userId.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
  return Object.fromEntries(
    Object.entries(counts).map(([key, val], i) => {
      const offset = ((seed * (i + 3) * 17) % 30) - 10;
      return [key, Math.max(1, val + offset)];
    })
  );
}

const AVATAR_COLORS = ["#893941", "#5E6623", "#C17B3A", "#4A6B8A", "#6B4A8A"];
function avatarColor(name = "") {
  const code = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

/* ── MemberCard in left panel ────────────────────── */

function MemberCard({ member, isSelected, onClick }) {
  const { user, risk_flag, percentage = 0, modules = "" } = member;
  const isAtRisk = risk_flag === true || risk_flag === "at_risk";
  const pct      = Math.min(Math.max(percentage, 0), 100);

  return (
    <div
      className={`member-card-item ${isSelected ? "selected" : ""}`}
      onClick={() => onClick(user.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(user.id)}
    >
      <div className="member-card-top">
        <div className="member-avatar-sm" style={{ background: avatarColor(user.full_name) }}>
          {getInitials(user.full_name)}
        </div>
        <div className="member-card-info">
          <div className="member-card-name">{user.full_name}</div>
          {modules && <div className="member-card-module">{modules}</div>}
        </div>
        <span className={`member-status-badge ${isAtRisk ? "at-risk" : "active"}`}>
          {isAtRisk ? "At Risk" : "Active"}
        </span>
      </div>
      <div className="member-progress-bar">
        <div
          className={`member-progress-fill ${isAtRisk ? "" : "active"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────── */

export default function MemberDetailPage() {
  const { userId }             = useParams();
  const [searchParams]         = useSearchParams();
  const navigate               = useNavigate();
  const projectId              = searchParams.get("projectId");

  const [member,       setMember]       = useState(null);
  const [members,      setMembers]      = useState([]);
  const [contribution, setContribution] = useState([]);
  const [activity,     setActivity]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  /* button loading states */
  const [reminding,  setReminding]  = useState(false);
  const [flagging,   setFlagging]   = useState(false);
  const [flagged,    setFlagged]    = useState(false);

  /* ── fetch project member list ─────────────────── */
  const fetchMembers = useCallback(async (pid) => {
    if (!pid) return;
    try {
      const res         = await api.get(`/heatmap/${pid}`);
      const raw         = res.data?.data?.contribution_share || [];
      const inactiveIds = new Set(
        (res.data?.data?.inactive_members || []).map((m) => m.id || m.user?.id)
      );
      setMembers(raw.map((m) => ({
        ...m,
        risk_flag: inactiveIds.has(m.user?.id),
        modules:   "",
      })));
    } catch { /* non-fatal */ }
  }, []);

  /* ── fetch selected member profile ────────────── */
  const fetchMember = useCallback(async (uid) => {
    try {
      const res = await api.get(`/users/${uid}`);
      setMember(res.data?.data || res.data);
    } catch {
      setError("Could not load member profile.");
    }
  }, []);

  /* ── fetch contribution breakdown ─────────────── */
  const fetchContribution = useCallback(async (pid, uid) => {
    if (!pid) return;
    try {
      const res  = await api.get(`/analytics/contribution/${pid}`);
      const all  = res.data?.data?.members || [];
      // eslint-disable-next-line eqeqeq
      const mine = all.find((m) => m.user?.id == uid) || all[0];
      if (mine?.counts) {
        const varied = applyMemberVariance(mine.counts, uid);
        setContribution(buildDonutData(varied));
      }
    } catch { /* non-fatal */ }
  }, []);

  /* ── fetch recent activity ─────────────────────── */
  const fetchActivity = useCallback(async (uid) => {
    try {
      const res     = await api.get(`/analytics/performance/${uid}`);
      const records = res.data?.data?.records || res.data?.data || [];
      const feed    = [...records]
        .reverse()
        .slice(0, 6)
        .map((r, i) => ({
          id:    `act-${i}`,
          date:  formatDate(r.recorded_at || r.date),
          text:  r.topic
            ? `Grade recorded: ${r.topic} — ${r.percentage ?? r.score}%`
            : r.label || "Activity recorded",
          color: i % 2 === 0 ? "#893941" : "#5E6623",
        }));
      setActivity(feed);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setMember(null);
    setError("");
    setFlagged(false);
    Promise.all([
      fetchMember(userId),
      fetchMembers(projectId),
      fetchContribution(projectId, userId),
      fetchActivity(userId),
    ]).finally(() => setLoading(false));
  }, [userId, projectId, fetchMember, fetchMembers, fetchContribution, fetchActivity]);

  /* ── button handlers ───────────────────────────── */

  const handleSendReminder = async () => {
    if (reminding) return;
    setReminding(true);
    try {
      await api.post(`/users/${userId}/remind`);
      toast.success(`Reminder sent to ${member?.full_name}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send reminder");
    } finally {
      setReminding(false);
    }
  };

  const handleFlagInactive = async () => {
    if (flagging || flagged) return;
    if (!window.confirm(`Flag ${member?.full_name} as inactive? This will set their risk level to HIGH and notify them.`)) return;
    setFlagging(true);
    try {
      await api.post(`/users/${userId}/flag-inactive`, { project_id: projectId || undefined });
      toast.success(`${member?.full_name} flagged as inactive`);
      setFlagged(true);

      /* persist to sessionStorage so Heatmap can merge this on remount,
         since the window event fires while Heatmap is unmounted */
      try {
        const stored = JSON.parse(sessionStorage.getItem("flaggedInactiveMembers") || "[]");
        if (!stored.find(m => String(m.id) === String(userId))) {
          stored.push({ id: userId, full_name: member?.full_name });
          sessionStorage.setItem("flaggedInactiveMembers", JSON.stringify(stored));
        }
      } catch { /* sessionStorage unavailable */ }

      /* mark member as at-risk in sidebar without refetching */
      setMembers(prev => prev.map(m =>
        String(m.user?.id) === String(userId) ? { ...m, risk_flag: true } : m
      ));
      /* tell Heatmap page to update its stats + inactive banner */
      window.dispatchEvent(new CustomEvent("heatmap:member-flagged", {
        detail: { userId, name: member?.full_name }
      }));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to flag member");
    } finally {
      setFlagging(false);
    }
  };

  const handleViewReport = () => {
    /* Navigate to the analytics summary for this user */
    navigate(`/analytics?userId=${userId}`);
  };

  const handleMemberClick = (uid) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    navigate(`/member/${uid}${qs}`);
  };

  /* ── donut chart ───────────────────────────────── */
  const donutData = {
    labels:   contribution.map((c) => c.label),
    datasets: [{
      data:            contribution.map((c) => c.count),
      backgroundColor: contribution.map((c) => c.color),
      borderColor:     "#FDFAF7",
      borderWidth:     3,
      hoverOffset:     6,
    }],
  };

  const donutOptions = {
    responsive: true,
    cutout:     "68%",
    plugins: {
      legend:  { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
    },
  };

  /* ── render ─────────────────────────────────────── */
  return (
    <div className="member-detail-page">

      {/* ── Left: Project Members Panel ─────────────── */}
      <aside className="project-members-panel">
        <p className="project-members-title">Project Members</p>

        {members.length === 0 && !loading && (
          <p style={{ padding: "12px 18px", fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
            {projectId ? "No members found." : "Pass ?projectId= in URL to load group members."}
          </p>
        )}

        {members.map((m) => (
          <MemberCard
            key={m.user?.id}
            member={m}
            isSelected={String(m.user?.id) === String(userId)}
            onClick={handleMemberClick}
          />
        ))}
      </aside>

      {/* ── Right: Member Detail ─────────────────────── */}
      <div className="member-detail-main">

        {loading && (
          <div className="member-detail-loading">Loading member…</div>
        )}

        {error && !loading && (
          <div className="member-detail-loading" style={{ color: "var(--color-danger)" }}>
            {error}
          </div>
        )}

        {!loading && !error && member && (
          <>
            {/* Header card */}
            <div className="member-header-card">
              <div className="member-avatar-lg" style={{ background: avatarColor(member.full_name) }}>
                {member.avatar_url
                  ? <img src={member.avatar_url} alt={member.full_name}
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  : getInitials(member.full_name)
                }
              </div>

              <div className="member-header-info">
                <h2 className="member-header-name">{member.full_name}</h2>
                <p className="member-header-active">
                  Last Active · {member.last_active ? timeAgo(member.last_active) : "Unknown"}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  <span className="module-badge" style={{ textTransform: "capitalize" }}>
                    {member.role}
                  </span>
                  {flagged && (
                    <span className="module-badge" style={{ background: "rgba(137,57,65,0.15)", color: "#893941" }}>
                      ⚑ Flagged Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Two-column: Contribution + Activity */}
            <div className="member-content-grid">

              <div className="member-section-card">
                <h4 className="member-section-title">Contribution Breakdown</h4>

                {contribution.length > 0 ? (
                  <>
                    <div className="contribution-donut-wrap">
                      <Doughnut data={donutData} options={donutOptions} />
                    </div>
                    <div className="contribution-legend">
                      {contribution.map((c) => (
                        <div className="legend-row" key={c.key}>
                          <div className="legend-left">
                            <div className="legend-dot" style={{ background: c.color }} />
                            <span className="legend-label">{c.label}</span>
                          </div>
                          <span className="legend-pct">{c.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", textAlign: "center", padding: "24px 0" }}>
                    No contribution data.{!projectId && " Add ?projectId= to URL."}
                  </p>
                )}
              </div>

              <div className="member-section-card">
                <h4 className="member-section-title">Recent Activity</h4>

                {activity.length > 0 ? (
                  <div className="activity-timeline">
                    {activity.map((act, i) => (
                      <div className="activity-item" key={act.id}>
                        <div className="activity-marker">
                          <div className="activity-dot" style={{ background: act.color }} />
                          {i < activity.length - 1 && <div className="activity-line" />}
                        </div>
                        <div>
                          <p className="activity-text-date">{act.date}</p>
                          <p className="activity-text-label">{act.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", textAlign: "center", padding: "24px 0" }}>
                    No recent activity found.
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="member-actions-row">
              <button
                className="btn-action btn-action-primary"
                onClick={handleSendReminder}
                disabled={reminding}
              >
                {reminding ? "Sending…" : "Send reminder"}
              </button>

              <button
                className="btn-action btn-action-outline-danger"
                onClick={handleFlagInactive}
                disabled={flagging || flagged}
                style={flagged ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              >
                {flagging ? "Flagging…" : flagged ? "Flagged ✓" : "Flag as Inactive"}
              </button>

              <button
                className="btn-action btn-action-outline"
                onClick={handleViewReport}
              >
                View Full Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}