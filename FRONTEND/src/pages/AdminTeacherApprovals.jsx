import { useState, useEffect, useCallback } from "react";
import { GraduationCap, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { safeData, Spinner, Badge, Avatar, card, btn, AdminPage } from "../components/admin/adminShared";

export default function AdminTeacherApprovals() {
  const [pendingTeachers, setPendingTeachers] = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [teacherActionId, setTeacherActionId] = useState(null);

  const loadPendingTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/pending-users?role=teacher");
      setPendingTeachers(safeData(res, []));
    } catch {
      setPendingTeachers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPendingTeachers(); }, [loadPendingTeachers]);

  const handleTeacherDecision = async (userId, decision) => {
    setTeacherActionId(userId);
    try {
      const res = await api.post(`/admin/${decision}-user/${userId}`);
      toast.success(res.data?.message || "Done");
      setPendingTeachers(prev => prev.filter(u => u.id !== userId));
    } catch (e) {
      toast.error(e?.response?.data?.error || "Action failed");
    }
    setTeacherActionId(null);
  };

  return (
    <AdminPage
      title="Teacher Approval"
      icon={<GraduationCap size={20} style={{ marginRight: -2 }} />}
      subtitle="Review teacher applications before they can sign in"
      actions={<button style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={loadPendingTeachers}><RotateCcw size={13} /> Refresh</button>}
    >
      {loading && <Spinner />}

      {!loading && (
        pendingTeachers.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "#9CA3AF", padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={24} /> No pending teacher applications.
          </div>
        ) : (
          pendingTeachers.map(u => {
            const acting = teacherActionId === u.id;
            return (
              <div key={u.id} style={{ ...card, borderLeft: "4px solid #16A34A" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Avatar name={u.full_name} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{u.full_name}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{u.email}</div>
                    </div>
                  </div>
                  <Badge text="Pending Approval" bg="#DCFCE7" color="#166534" />
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    style={{ ...btn("primary"), display: "inline-flex", alignItems: "center", gap: 6 }}
                    disabled={acting}
                    onClick={() => handleTeacherDecision(u.id, "approve")}
                  >
                    <CheckCircle2 size={13} /> Approve
                  </button>
                  <button
                    style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }}
                    disabled={acting}
                    onClick={() => handleTeacherDecision(u.id, "reject")}
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
            );
          })
        )
      )}
    </AdminPage>
  );
}
