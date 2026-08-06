import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, Users, Zap, CalendarDays } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import "./Heatmap.css";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function heatLevel(count) {
  if (count === 0) return 0;
  if (count <= 2)  return 1;
  if (count <= 5)  return 2;
  if (count <= 10) return 3;
  return 4;
}

function formatDateCol(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

export default function HeatmapPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const isTeamView  = user?.role === "teacher" || user?.role === "admin";

  const [data,       setData]       = useState(null);
  const [projectId,  setProjectId]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [notifying,  setNotifying]  = useState(false);
  const [error,      setError]      = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  /* ── 1. get the user's first project, then load heatmap ─── */
  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        /* fetch projects this user belongs to */
        const projRes = await api.get(`/users/${user.id}/projects`);
        const projects = projRes.data?.data || projRes.data || [];

        if (!projects.length) {
          setError("You are not assigned to any project yet.");
          setLoading(false);
          return;
        }

        const pid = projects[0].id;
        setProjectId(pid);

        /* fetch heatmap data for that project */
        const hmRes = await api.get(`/heatmap/${pid}`);
        const hmData = hmRes.data?.data || hmRes.data;

        /* merge any client-side flagged members that the API hasn't picked up yet */
        let stored = [];
        try {
          stored = JSON.parse(sessionStorage.getItem("flaggedInactiveMembers") || "[]");
        } catch { /* ignore */ }

        if (stored.length > 0) {
          const apiInactiveIds = new Set(
            (hmData.inactive_members || []).map(m => String(m.id || m.user?.id))
          );
          /* drop entries that the API now reports as inactive (no longer needed) */
          const remaining = stored.filter(m => !apiInactiveIds.has(String(m.id)));
          try {
            sessionStorage.setItem("flaggedInactiveMembers", JSON.stringify(remaining));
          } catch { /* ignore */ }

          if (remaining.length > 0) {
            hmData.inactive_members = [
              ...(hmData.inactive_members || []),
              ...remaining,
            ];
            hmData.stats = {
              ...hmData.stats,
              active_members: Math.max(
                0,
                (hmData.stats?.active_members ?? 0) - remaining.length
              ),
            };
          }
        }

        setData(hmData);
      } catch {
        setError("Could not load heatmap data.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, refreshKey]);

  /* refetch whenever this route is navigated to (covers returning from MemberDetail)
     and also when the window regains focus from another browser tab */
  useEffect(() => {
    setRefreshKey(k => k + 1);
  }, [location.key]);

  useEffect(() => {
    const onFocus = () => setRefreshKey(k => k + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  /* listen for flag events from MemberDetail — update stats + banner immediately */
  useEffect(() => {
    const onFlagged = (e) => {
      const { userId: flaggedId, name } = e.detail || {};
      setData(prev => {
        if (!prev) return prev;
        const alreadyListed = (prev.inactive_members || []).some(
          m => String(m.id || m.user?.id) === String(flaggedId)
        );
        return {
          ...prev,
          stats: {
            ...prev.stats,
            active_members: alreadyListed
              ? prev.stats.active_members
              : Math.max(0, (prev.stats.active_members || 0) - 1),
          },
          inactive_members: alreadyListed
            ? prev.inactive_members
            : [...(prev.inactive_members || []), { id: flaggedId, full_name: name }],
        };
      });
    };
    window.addEventListener("heatmap:member-flagged", onFlagged);
    return () => window.removeEventListener("heatmap:member-flagged", onFlagged);
  }, []);

  /* ── Notify All inactive members (teacher/admin only) ──────── */
  const handleNotifyAll = async () => {
    const inactiveList = data?.inactive_members || [];
    const allMembers   = data?.members || [];
    if (!projectId || notifying || !inactiveList.length || !allMembers.length) return;
    setNotifying(true);

    const inactiveNames = inactiveList
      .map(m => m.full_name || m.user?.full_name)
      .filter(Boolean)
      .join(", ");

    const message = `A heads-up from your instructor: ${inactiveNames} ${inactiveList.length > 1 ? "have" : "has"} been inactive for 5+ days. Please check in with your teammate${inactiveList.length > 1 ? "s" : ""} and encourage them to re-engage with the project.`;

    const succeeded = [];
    const failed    = [];

    try {
      await Promise.all(
        allMembers.map(async (m) => {
          const memberId = m.user?.id;
          const name     = m.user?.full_name || "Member";
          try {
            await api.post(`/users/${memberId}/remind`, { message });
            succeeded.push(name);
          } catch {
            failed.push(name);
          }
        })
      );

      if (succeeded.length > 0) {
        toast.success(
          `Notified ${succeeded.length} member${succeeded.length > 1 ? "s" : ""} about ${inactiveNames}`
        );
      }
      if (failed.length > 0) {
        toast.error(`Could not reach: ${failed.join(", ")}`);
      }
    } finally {
      setNotifying(false);
    }
  };

  /* ── Navigate to member detail (teacher/admin only) ────────── */
  const handleMemberClick = (memberId) => {
    if (!isTeamView) return;
    const qs = projectId ? `?projectId=${projectId}` : "";
    navigate(`/member/${memberId}${qs}`);
  };

  /* ── Render ─────────────────────────────────────── */
  if (loading) {
    return <div className="text-muted" style={{ padding: 40, fontSize: "0.9rem" }}>Loading heatmap…</div>;
  }

  if (error) {
    return <div style={{ padding: 40, fontSize: "0.9rem", color: "var(--color-danger)" }}>{error}</div>;
  }

  if (!data) return null;

  const { date_cols = [], members = [], contribution_share = [], inactive_members = [], stats = {} } = data;

  return (
    <div>
      <h2 className="heatmap-title">{isTeamView ? "Team Collaboration Heatmap" : "My Activity Heatmap"}</h2>
      <p className="heatmap-subtitle">
        {isTeamView
          ? "Visual activity breakdown for your project group"
          : "Your activity over the last 7 days"}
      </p>

      {/* ── Inactive alert banner (teacher/admin only) ────────── */}
      {isTeamView && inactive_members.length > 0 && (
        <div className="heatmap-alert">
          <span className="alert-left">
            <AlertTriangle size={15} />
            {inactive_members.length} member{inactive_members.length > 1 ? "s have" : " has"} been inactive for 5+ days
          </span>
          <button className="btn btn-primary btn-sm" onClick={handleNotifyAll} disabled={notifying}>
            {notifying ? "Sending…" : "Notify All"}
          </button>
        </div>
      )}

      <div className="heatmap-main" style={!isTeamView ? { gridTemplateColumns: "1fr" } : undefined}>

        {/* ── Activity Grid ─────────────────────────── */}
        <div className="card">
          <p className="section-label">Activity Grid</p>

          <div className="heatmap-grid-wrap">
            <div className="activity-grid" style={{ gridTemplateColumns: `100px repeat(${date_cols.length}, minmax(36px, 1fr))` }}>
              <div className="grid-name-col" />
              {date_cols.map((d, i) => (
                <div key={i} className="grid-day-header">{formatDateCol(d)}</div>
              ))}

              {members.map(m => (
                <div key={m.user.id} className="grid-row">
                  <div
                    className="grid-name"
                    style={{ cursor: isTeamView ? "pointer" : "default", gap: 6 }}
                    onClick={() => handleMemberClick(m.user.id)}
                    title={isTeamView ? `View ${m.user.full_name}'s profile` : m.user.full_name}
                  >
                    <span className="avatar avatar-sm">{getInitials(m.user.full_name)}</span>
                    {isTeamView ? m.user.full_name.split(" ")[0] : "You"}
                  </div>

                  {date_cols.map((d, i) => (
                    <div
                      key={i}
                      className={`grid-cell level-${heatLevel(m.activity[d] || 0)}`}
                      title={`${d}: ${m.activity[d] || 0} actions`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="grid-legend">
            <span className="text-xs text-muted">Legend:</span>
            {["None", "Low", "Med", "High"].map((label, i) => (
              <div key={label} className="legend-item">
                <div className={`legend-cell level-${i}`} />
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contribution Share (teacher/admin only) ─────────── */}
        {isTeamView && (
          <div className="card contribution-share">
            <p className="section-label">Contribution Share</p>
            <div className="contrib-list">
              {contribution_share.map((m, i) => (
                <div
                  key={m.user.id}
                  className="contrib-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleMemberClick(m.user.id)}
                  title={`View ${m.user.full_name}'s profile`}
                >
                  <div className={`avatar avatar-sm contrib-avatar color-${i % 5}`}>
                    {getInitials(m.user.full_name)}
                  </div>
                  <div className="contrib-info">
                    <div className="flex-between">
                      <span className="contrib-name">{m.user.full_name}</span>
                      <span className="contrib-pct">{m.percentage}%</span>
                    </div>
                    <div className="progress-bar mt-4">
                      <div className="progress-fill" style={{ width: `${m.percentage}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Stats row ─────────────────────────────── */}
      <div className="grid-3 mt-16">
        {[
          {
            icon:  Users,
            value: isTeamView
              ? `${stats.active_members ?? "—"}/${stats.total_members ?? "—"}`
              : ((stats.total_actions ?? 0) > 0 ? "Active" : "No activity yet"),
            label: isTeamView ? "Active Members" : "Your Status",
          },
          { icon: Zap,          value: stats.total_actions ?? "—",   label: "Total Actions"   },
          { icon: CalendarDays, value: stats.most_active_day ?? "—", label: "Most Active Day" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon"><s.icon size={20} /></div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
