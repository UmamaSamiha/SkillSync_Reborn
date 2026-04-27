import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import "./Heatmap.css";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const HEAT_COLORS = {
  0: "#EAEAD8",
  1: "#D4D994",
  2: "#A8AF4A",
  3: "#5E6623",
  4: "#3D4316",
};

const CONTRIB_COLORS = ["#893941","#CB7885","#D4D994","#5E6623","#7A5C8A"];

function getHeatColor(count) {
  if (count === 0) return HEAT_COLORS[0];
  if (count <= 2)  return HEAT_COLORS[1];
  if (count <= 5)  return HEAT_COLORS[2];
  if (count <= 10) return HEAT_COLORS[3];
  return HEAT_COLORS[4];
}

function formatDateCol(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

export default function HeatmapPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();

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

  /* ── Notify All inactive members ───────────────── */
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

  /* ── Navigate to member detail ─────────────────── */
  const handleMemberClick = (memberId) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    navigate(`/member/${memberId}${qs}`);
  };

  /* ── Render ─────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ padding: 40, color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
        Loading heatmap…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: "var(--color-danger)", fontSize: "0.9rem" }}>
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { date_cols = [], members = [], contribution_share = [], inactive_members = [], stats = {} } = data;

  return (
    <div>
      <h2 style={{ marginBottom: 4, fontFamily: "'Playfair Display',serif" }}>
        Team Collaboration Heatmap
      </h2>
      <p style={{ color: "#7A7063", fontSize: "0.88rem", marginBottom: 20 }}>
        Visual activity breakdown for your project group
      </p>

      {/* ── Inactive alert banner ─────────────────── */}
      {inactive_members.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#FEF3C7", border: "1px solid #F9C74F",
          borderRadius: 10, padding: "10px 16px", marginBottom: 20, flexWrap: "wrap", gap: 8,
        }}>
          <span style={{ fontSize: "0.85rem", color: "#78350F", fontWeight: 500 }}>
            ⚠ {inactive_members.length} member{inactive_members.length > 1 ? "s have" : " has"} been inactive for 5+ days
          </span>
          <button
            onClick={handleNotifyAll}
            disabled={notifying}
            style={{
              background: notifying ? "#aaa" : "#893941",
              color: "#fff", border: "none",
              borderRadius: 999, padding: "6px 14px",
              fontSize: "0.8rem", cursor: notifying ? "not-allowed" : "pointer",
              transition: "background 150ms",
            }}
          >
            {notifying ? "Sending…" : "Notify All"}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>

        {/* ── Activity Grid ─────────────────────────── */}
        <div style={{ background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)", borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7A7063", marginBottom: 16 }}>
            Activity Grid
          </p>

          <div style={{ overflowX: "auto" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: `100px repeat(${date_cols.length}, minmax(36px, 1fr))`,
              gap: 6,
              minWidth: date_cols.length * 40 + 100,
            }}>
              {/* Header row */}
              <div />
              {date_cols.map((d, i) => (
                <div key={i} style={{
                  textAlign: "center", fontSize: "0.68rem",
                  fontWeight: 600, color: "#7A7063",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {formatDateCol(d)}
                </div>
              ))}

              {/* Member rows */}
              {members.map(m => (
                <div key={m.user.id} style={{ display: "contents" }}>
                  <div
                    style={{
                      fontSize: "0.82rem", fontWeight: 500,
                      display: "flex", alignItems: "center", gap: 6,
                      cursor: "pointer", color: "var(--color-text)",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => handleMemberClick(m.user.id)}
                    title={`View ${m.user.full_name}'s profile`}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: "#893941", color: "#fff",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.6rem", fontWeight: 700, flexShrink: 0,
                    }}>
                      {getInitials(m.user.full_name)}
                    </span>
                    {m.user.full_name.split(" ")[0]}
                  </div>

                  {date_cols.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        aspectRatio: "1", borderRadius: 6,
                        background: getHeatColor(m.activity[d] || 0),
                        cursor: "pointer",
                        transition: "transform 100ms",
                      }}
                      title={`${m.user.full_name} · ${d}: ${m.activity[d] || 0} actions`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", color: "#7A7063" }}>Legend:</span>
            {[["#EAEAD8","None"],["#D4D994","Low"],["#A8AF4A","Med"],["#5E6623","High"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
                <span style={{ fontSize: "0.75rem", color: "#7A7063" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contribution Share ────────────────────── */}
        <div style={{ background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)", borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7A7063", marginBottom: 16 }}>
            Contribution Share
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {contribution_share.map((m, i) => (
              <div
                key={m.user.id}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                onClick={() => handleMemberClick(m.user.id)}
                title={`View ${m.user.full_name}'s profile`}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: CONTRIB_COLORS[i % CONTRIB_COLORS.length],
                  color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "0.75rem",
                  fontWeight: 600, flexShrink: 0,
                }}>
                  {getInitials(m.user.full_name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{m.user.full_name}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#893941" }}>{m.percentage}%</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(45,45,45,0.1)", borderRadius: 999, marginTop: 5, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 999,
                      background: `linear-gradient(90deg,${CONTRIB_COLORS[i % CONTRIB_COLORS.length]},rgba(255,255,255,0.3))`,
                      width: `${m.percentage}%`,
                      transition: "width 600ms ease",
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 20 }}>
        {[
          { icon: "👥", value: `${stats.active_members ?? "—"}/${stats.total_members ?? "—"}`, label: "Active Members" },
          { icon: "⚡", value: stats.total_actions ?? "—",   label: "Total Actions"   },
          { icon: "📅", value: stats.most_active_day ?? "—", label: "Most Active Day" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)",
            borderRadius: 16, padding: "20px 24px",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "rgba(137,57,65,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.2rem",
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "0.8rem", color: "#7A7063", marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}