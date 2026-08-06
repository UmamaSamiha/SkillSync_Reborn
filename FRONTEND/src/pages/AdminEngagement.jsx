import { useState, useCallback, useEffect } from "react";
import { Lightbulb, RefreshCw, RotateCcw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import api from "../utils/api";
import {
  safeData, Spinner, Avatar, EngBar, engColor, engLabel,
  card, btn, AdminPage,
} from "../components/admin/adminShared";

export default function AdminEngagement() {
  const [engagementData, setEngagementData] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [engMsg,     setEngMsg]     = useState("");
  const [calcingAll, setCalcingAll] = useState(false);
  const [calcingOne, setCalcingOne] = useState(null);

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

  useEffect(() => { loadEngagement(); }, [loadEngagement]);

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

  return (
    <AdminPage
      title="Engagement Scores"
      icon={<Lightbulb size={20} style={{ marginRight: -2 }} />}
      subtitle="Current week · Forum 25% · Submissions 35% · Resources 20% · Quiz 20%"
      actions={<>
        <button style={{ ...btn("primary"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={calcAllEngagement} disabled={calcingAll}>
          {calcingAll ? "Calculating..." : <><RefreshCw size={13} /> Recalculate All</>}
        </button>
        <button style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={loadEngagement}><RotateCcw size={13} /> Refresh</button>
      </>}
    >
      {loading && <Spinner />}

      {!loading && engMsg && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, marginBottom: 14,
          fontSize: "0.85rem", fontWeight: 600,
          background: engMsg.startsWith("✅") ? "#DCFCE7" : "#FEE2E2",
          color:      engMsg.startsWith("✅") ? "#166534" : "#991B1B",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {engMsg.startsWith("✅") ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {engMsg.replace(/^[✅❌]\s*/, "")}
        </div>
      )}

      {!loading && (
        engagementData.length === 0 ? (
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
                      style={{ ...btn("ghost"), padding: "4px 12px", fontSize: "0.75rem", opacity: isCalc ? 0.6 : 1, display: "inline-flex", alignItems: "center" }}
                      onClick={() => calcOneEngagement(item?.user?.id)}
                      disabled={isCalc}
                    >
                      {isCalc ? <Loader2 size={13} className="spin-icon" /> : <RefreshCw size={13} />}
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
        )
      )}
    </AdminPage>
  );
}
