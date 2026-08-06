import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, RotateCcw, CheckCircle2, XCircle, PlusCircle, MinusCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { safeData, Spinner, Badge, card, btn, AdminPage } from "../components/admin/adminShared";

export default function AdminCourseApprovals() {
  const [pendingCourses, setPendingCourses] = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [courseActionId, setCourseActionId] = useState(null);

  const loadPendingCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/courses/pending");
      setPendingCourses(safeData(res, []));
    } catch {
      setPendingCourses([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPendingCourses(); }, [loadPendingCourses]);

  const handleCourseDecision = async (courseId, decision) => {
    setCourseActionId(courseId);
    try {
      const res = await api.post(`/courses/${courseId}/${decision}`);
      toast.success(res.data?.message || "Done");
      setPendingCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (e) {
      toast.error(e?.response?.data?.error || "Action failed");
    }
    setCourseActionId(null);
  };

  return (
    <AdminPage
      title="Course Approvals"
      icon={<ClipboardCheck size={20} style={{ marginRight: -2 }} />}
      subtitle="New courses and removal requests awaiting your sign-off"
      actions={<button style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }} onClick={loadPendingCourses}><RotateCcw size={13} /> Refresh</button>}
    >
      {loading && <Spinner />}

      {!loading && (
        pendingCourses.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "#9CA3AF", padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={24} /> No pending course requests.
          </div>
        ) : (
          pendingCourses.map(c => {
            const isDeletion = c.status === "pending_deletion";
            const acting = courseActionId === c.id;
            return (
              <div key={c.id} style={{ ...card, borderLeft: `4px solid ${isDeletion ? "#DC2626" : "#16A34A"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {isDeletion
                      ? <MinusCircle size={20} style={{ color: "#DC2626", flexShrink: 0, marginTop: 2 }} />
                      : <PlusCircle size={20} style={{ color: "#16A34A", flexShrink: 0, marginTop: 2 }} />}
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {c.code} — {c.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                        {isDeletion ? "Removal requested" : "New course"} by <b>{c.instructor || "Unknown"}</b>
                      </div>
                      {c.description && (
                        <div style={{ fontSize: 12, color: "#7A7063", marginTop: 6 }}>{c.description}</div>
                      )}
                    </div>
                  </div>
                  <Badge
                    text={isDeletion ? "Pending Removal" : "Pending Approval"}
                    bg={isDeletion ? "#FEE2E2" : "#DCFCE7"}
                    color={isDeletion ? "#991B1B" : "#166534"}
                  />
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    style={{ ...btn("primary"), display: "inline-flex", alignItems: "center", gap: 6 }}
                    disabled={acting}
                    onClick={() => handleCourseDecision(c.id, "approve")}
                  >
                    <CheckCircle2 size={13} /> {isDeletion ? "Approve Removal" : "Approve"}
                  </button>
                  <button
                    style={{ ...btn("ghost"), display: "inline-flex", alignItems: "center", gap: 6 }}
                    disabled={acting}
                    onClick={() => handleCourseDecision(c.id, "reject")}
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
