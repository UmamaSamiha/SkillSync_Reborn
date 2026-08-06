/* ── Shared helpers/components for the Admin section pages ──────────── */

function getInitials(name = "") {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}

/**
 * Universal Data Extractor
 * Safely extracts an array from any API response format.
 */
export const safeData = (response, fallback = []) => {
  if (!response) return fallback;
  const payload = response.data ? response.data : response;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  const commonKeys = ['submissions', 'items', 'results'];
  for (let key of commonKeys) {
    if (payload && Array.isArray(payload[key])) {
      return payload[key];
    }
  }
  return fallback;
};

export const RISK_META = {
  high:   { label: "High Risk",   bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  medium: { label: "Medium Risk", bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B" },
  low:    { label: "Low Risk",    bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
};

export const TREND_ICON = { rising: "↑", falling: "↓", stable: "→" };
export const TREND_COLOR = { rising: "#16A34A", falling: "#DC2626", stable: "#6B7280" };

export function engColor(score) {
  if (score >= 75) return "#16A34A";
  if (score >= 45) return "#C17B3A";
  return "#DC2626";
}
export function engLabel(score) {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export function EngBar({ value = 0, color = "#893941", label = "" }) {
  return (
    <div style={{ flex: 1, minWidth: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 6, background: "#F3F4F6", borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: color, borderRadius: 99, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

export function StatCard({ label, value, icon, color = "#893941" }) {
  return (
    <div style={{
      background: "#FDFAF7",
      border: "1px solid rgba(137,57,65,0.15)",
      borderRadius: 14,
      padding: "18px 22px",
      flex: 1,
      minWidth: 130,
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "Georgia, serif" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 12, color: "#7A7063", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function Badge({ text, bg, color }) {
  return (
    <span style={{
      background: bg, color, fontSize: 11, fontWeight: 700,
      padding: "2px 10px", borderRadius: 999, display: "inline-block",
    }}>{text}</span>
  );
}

export function Avatar({ name, size = 36 }) {
  const colors = ["#893941","#CB7885","#5E6623","#7A5C8A","#C17B3A"];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div className="spin-icon" style={{
        width: 32, height: 32, border: "3px solid #F3F4F6",
        borderTop: "3px solid #893941", borderRadius: "50%",
      }} />
    </div>
  );
}

/* ── Shared inline style helpers ─────────────────────────────────────── */
export const card = {
  background: "#FDFAF7",
  border: "1px solid rgba(137,57,65,0.12)",
  borderRadius: 16,
  padding: "18px 22px",
  marginBottom: 14,
};

export const btn = (variant = "primary") => ({
  padding: "8px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 700,
  background: variant === "primary" ? "#893941" : variant === "ghost" ? "transparent" : "#F5F0EB",
  color:      variant === "primary" ? "#fff"    : "#893941",
  border:     variant === "ghost" ? "1px solid #893941" : "none",
});

export const inputStyle = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(137,57,65,0.2)",
  background: "#FDFAF7",
  fontSize: "0.9rem",
  outline: "none",
  width: 260,
};

/* ── Page wrapper — consistent frame for every admin page ────────────── */
export function AdminPage({ title, subtitle, icon, actions, children }) {
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#2D2D2D", maxWidth: 960, margin: "0 auto", padding: "24px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.6rem", fontFamily: "Georgia, serif", color: "#893941", display: "flex", alignItems: "center", gap: 10 }}>
            {icon}{title}
          </h2>
          {subtitle && <p style={{ margin: "4px 0 0", color: "#7A7063", fontSize: "0.9rem" }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}
