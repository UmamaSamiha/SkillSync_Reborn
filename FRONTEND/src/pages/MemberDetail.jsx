import { useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const MEMBER = {
  full_name: "Tahmina Akhter",
  role: "student",
  last_active: "2026-03-04T09:22:00Z",
  modules_done: "3/5",
  contribution: { file_upload:35, comments:30, forum_posts:20, quiz_attempts:15 },
  recent_activity: [
    { id:"a1", date:"Mar 5, 2026",  color:"#5E6623", text:"Uploaded heatmap module.py"   },
    { id:"a2", date:"Feb 14, 2026", color:"#893941", text:"Commented on PR #2"            },
    { id:"a3", date:"Feb 12, 2026", color:"#893941", text:"Submitted Assignment 2"        },
    { id:"a4", date:"Feb 12, 2026", color:"#CB7885", text:"Posted in Forum: DB Notes"    },
  ],
};

const COLORS  = ["#893941","#CB7885","#D4D994","#5E6623"];
const LABELS  = ["File Uploads","Comments","Forum Posts","Quiz Attempts"];

export default function MemberDetailPage() {
  const [member] = useState(MEMBER);

  const donutData = {
    labels: LABELS,
    datasets: [{
      data:            Object.values(member.contribution),
      backgroundColor: COLORS,
      borderColor:     "#FDFAF7",
      borderWidth:     3,
      hoverOffset:     6,
    }],
  };

  const donutOptions = {
    responsive:   true,
    cutout:       "68%",
    plugins: {
      legend:  { display:false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}%` }},
    },
  };

  return (
    <div>
      <h2 style={{ marginBottom:24, fontFamily:"'Playfair Display',serif" }}>
        Member Detail
      </h2>

      <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:20, alignItems:"start" }}>

        <div style={{ background:"#FDFAF7", border:"1px solid rgba(45,45,45,0.1)", borderRadius:16, padding:24 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16 }}>
            <div style={{
              width:52, height:52, borderRadius:"50%",
              background:"#893941", color:"#fff",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"1.1rem", fontWeight:600, marginBottom:12
            }}>
              {getInitials(member.full_name)}
            </div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", marginBottom:4 }}>
              {member.full_name}
            </h3>
            <p style={{ fontSize:"0.82rem", color:"#7A7063" }}>
              Last Active · 2 days ago
            </p>
            <p style={{ fontSize:"0.82rem", color:"#7A7063", marginTop:4 }}>
              Modules: {member.modules_done}
            </p>
          </div>

          <div style={{ width:180, margin:"0 auto 20px" }}>
            <Doughnut data={donutData} options={donutOptions} />
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
            {LABELS.map((label,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:COLORS[i] }} />
                  <span style={{ fontSize:"0.82rem", color:"#2D2D2D" }}>{label}</span>
                </div>
                <span style={{ fontSize:"0.82rem", fontWeight:600, color:"#7A7063" }}>
                  {Object.values(member.contribution)[i]}%
                </span>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <button style={{
              padding:"8px 18px", borderRadius:999, fontSize:"0.875rem",
              fontWeight:500, cursor:"pointer",
              background:"transparent", color:"#893941",
              border:"1.5px solid #893941"
            }}>Send reminder</button>
            <button style={{
              padding:"8px 18px", borderRadius:999, fontSize:"0.875rem",
              fontWeight:500, cursor:"pointer",
              background:"transparent", color:"#7A7063",
              border:"1.5px solid rgba(45,45,45,0.2)"
            }}>Flag as Inactive</button>
            <button style={{
              padding:"8px 18px", borderRadius:999, fontSize:"0.875rem",
              fontWeight:500, cursor:"pointer",
              background:"#893941", color:"#fff", border:"none"
            }}>View Full Report</button>
          </div>
        </div>

        <div style={{ background:"#FDFAF7", border:"1px solid rgba(45,45,45,0.1)", borderRadius:16, padding:24 }}>
          <h4 style={{ marginBottom:20, fontFamily:"'DM Sans',sans-serif" }}>
            Recent Activity
          </h4>
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {member.recent_activity.map((act, i) => (
              <div key={act.id} style={{ display:"flex", gap:16, paddingBottom:20, position:"relative" }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                  <div style={{
                    width:10, height:10, borderRadius:"50%",
                    background:act.color, flexShrink:0, marginTop:4
                  }} />
                  {i < member.recent_activity.length - 1 && (
                    <div style={{ width:2, flex:1, background:"rgba(45,45,45,0.1)", marginTop:4 }} />
                  )}
                </div>
                <div>
                  <p style={{ fontSize:"0.78rem", color:"#7A7063", marginBottom:4 }}>{act.date}</p>
                  <p style={{ fontSize:"0.88rem", color:"#2D2D2D", fontWeight:500 }}>{act.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}