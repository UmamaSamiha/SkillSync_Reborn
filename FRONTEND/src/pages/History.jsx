import { useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, Tooltip, Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const SAMPLE_SESSIONS = [
  { id:"1", started_at:"2026-03-03", topic_label:"Database Systems", duration_minutes:50,  sessions_count:2, status:"completed"  },
  { id:"2", started_at:"2026-03-02", topic_label:"Algorithms",       duration_minutes:75,  sessions_count:3, status:"completed"  },
  { id:"3", started_at:"2026-03-01", topic_label:"System Design",    duration_minutes:25,  sessions_count:1, status:"interrupted"},
  { id:"4", started_at:"2026-02-28", topic_label:"Database Systems", duration_minutes:300, sessions_count:4, status:"completed"  },
  { id:"5", started_at:"2026-02-25", topic_label:"Networks",         duration_minutes:50,  sessions_count:2, status:"completed"  },
];

const WEEKLY = [
  { day:"Mon", hours:1.5 },
  { day:"Tue", hours:2.0 },
  { day:"Wed", hours:3.5 },
  { day:"Thu", hours:2.8 },
  { day:"Fri", hours:3.0 },
  { day:"Sat", hours:0.5 },
  { day:"Sun", hours:0.8 },
];

const STATUS_BADGE = {
  completed:   { color:"#5E6623", bg:"#D4D994", label:"Completed"   },
  interrupted: { color:"#893941", bg:"#F5D0D3", label:"Interrupted" },
  in_progress: { color:"#4A6B8A", bg:"#D0E4F5", label:"Active"      },
};

export default function HistoryPage() {
  const [sessions] = useState(SAMPLE_SESSIONS);

  const chartData = {
    labels: WEEKLY.map(d => d.day),
    datasets: [{
      label: "Focus Hours",
      data:  WEEKLY.map(d => d.hours),
      backgroundColor: WEEKLY.map((_,i) => [2,4].includes(i) ? "#893941" : "#A8AF4A"),
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display:false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.raw}h` }},
    },
    scales: {
      x: { grid:{ display:false }, ticks:{ color:"#7A7063", font:{ size:11 }}},
      y: { grid:{ color:"rgba(0,0,0,0.06)" }, ticks:{ color:"#7A7063", font:{ size:11 }}, beginAtZero:true },
    },
  };

  return (
    <div>
      <h2 style={{ marginBottom:4, fontFamily:"'Playfair Display',serif" }}>
        My Session History
      </h2>
      <p style={{ color:"#7A7063", fontSize:"0.88rem", marginBottom:24 }}>
        Track your productivity and focus patterns
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
        {[
          { icon:"🕐", value:"14h 20m", label:"Total Focus Time",     color:"#893941" },
          { icon:"✅", value:"23",      label:"Sessions Completed",   color:"#5E6623" },
          { icon:"🔥", value:"5 days",  label:"Current Streak",       color:"#C17B3A" },
        ].map((s,i) => (
          <div key={i} style={{
            background:"#FDFAF7", border:"1px solid rgba(45,45,45,0.1)",
            borderRadius:16, padding:"20px 24px",
            display:"flex", alignItems:"center", gap:16
          }}>
            <div style={{
              width:44, height:44, borderRadius:10,
              background:"rgba(137,57,65,0.12)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"1.2rem"
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize:"1.6rem", fontWeight:700, lineHeight:1, color:s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize:"0.8rem", color:"#7A7063", marginTop:2 }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background:"#FDFAF7", border:"1px solid rgba(45,45,45,0.1)",
        borderRadius:16, padding:24, marginBottom:24
      }}>
        <h4 style={{ marginBottom:16, fontFamily:"'DM Sans',sans-serif" }}>
          Daily Focus Hours This Week
        </h4>
        <div style={{ height:200 }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>

      <div style={{
        background:"#FDFAF7", border:"1px solid rgba(45,45,45,0.1)",
        borderRadius:16, padding:24
      }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["Date","Topic","Duration","Sessions","Status"].map(h => (
                <th key={h} style={{
                  textAlign:"left", padding:"10px 14px",
                  fontSize:"0.75rem", fontWeight:600,
                  color:"#7A7063", textTransform:"uppercase",
                  letterSpacing:"0.05em",
                  borderBottom:"1px solid rgba(45,45,45,0.1)"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => {
              const badge = STATUS_BADGE[s.status] || STATUS_BADGE.completed;
              const date  = new Date(s.started_at).toLocaleDateString("en",{
                month:"short", day:"numeric", year:"numeric"
              });
              return (
                <tr key={s.id}>
                  <td style={{ padding:"12px 14px", fontSize:"0.875rem", color:"#7A7063", borderBottom:"1px solid rgba(45,45,45,0.1)" }}>{date}</td>
                  <td style={{ padding:"12px 14px", fontSize:"0.875rem", fontWeight:500, borderBottom:"1px solid rgba(45,45,45,0.1)" }}>{s.topic_label}</td>
                  <td style={{ padding:"12px 14px", fontSize:"0.875rem", borderBottom:"1px solid rgba(45,45,45,0.1)" }}>{s.duration_minutes} min</td>
                  <td style={{ padding:"12px 14px", fontSize:"0.875rem", textAlign:"center", borderBottom:"1px solid rgba(45,45,45,0.1)" }}>{s.sessions_count}</td>
                  <td style={{ padding:"12px 14px", borderBottom:"1px solid rgba(45,45,45,0.1)" }}>
                    <span style={{
                      display:"inline-flex", alignItems:"center",
                      padding:"3px 10px", borderRadius:999,
                      fontSize:"0.75rem", fontWeight:600,
                      background:badge.bg, color:badge.color
                    }}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}