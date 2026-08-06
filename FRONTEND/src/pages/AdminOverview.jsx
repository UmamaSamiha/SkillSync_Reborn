import { useState, useEffect, useCallback } from "react";
import { GraduationCap, Users, Flag, AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import { safeData, StatCard, Spinner, btn, AdminPage } from "../components/admin/adminShared";

export default function AdminOverview() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading,  setLoading]  = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/overview");
      setOverview(safeData(res, null));
    } catch { setOverview(null); }
    setLoading(false);
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const recalcAllRisk = async () => {
    setLoading(true);
    try {
      await api.post("/admin/recalculate-all-risk");
    } catch (e) {
      alert("Failed: " + (e?.response?.data?.error || e.message));
    }
    setLoading(false);
  };

  return (
    <AdminPage title="Admin Dashboard" subtitle={<>Welcome back, <b>{user?.full_name}</b></>}>
      {loading && <Spinner />}

      {!loading && (
        overview ? (
          <div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
              <StatCard label="Total Students"  value={overview.total_students}  icon={<GraduationCap size={22} />} color="#893941" />
              <StatCard label="Total Teachers"  value={overview.total_teachers}  icon={<Users size={22} />} color="#5E6623" />
              <StatCard label="Flagged Submissions" value={overview.flagged_count}   icon={<Flag size={22} />} color="#C17B3A" />
              <StatCard label="High Risk Students"  value={overview.high_risk_count} icon={<AlertTriangle size={22} />} color="#DC2626" />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={recalcAllRisk}><RefreshCw size={13} /> Recalculate All Risk</button>
              <button style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={loadOverview}><RotateCcw size={13} /> Refresh</button>
            </div>
          </div>
        ) : (
          <p style={{ color: "#9CA3AF" }}>Could not load overview. Check backend connection.</p>
        )
      )}
    </AdminPage>
  );
}
