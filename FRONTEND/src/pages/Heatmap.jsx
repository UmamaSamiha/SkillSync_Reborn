import { useState } from "react";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const DUMMY = {
  date_cols: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  members: [
    { user: { id:"1", full_name:"Anushka" }, activity: { Mon:4,Tue:5,Wed:4,Thu:3,Fri:4,Sat:1,Sun:0 }, total:21 },
    { user: { id:"2", full_name:"Tahmina" }, activity: { Mon:3,Tue:0,Wed:2,Thu:4,Fri:3,Sat:0,Sun:0 }, total:12 },
    { user: { id:"3", full_name:"Parisa"  }, activity: { Mon:2,Tue:3,Wed:1,Thu:2,Fri:2,Sat:1,Sun:0 }, total:11 },
    { user: { id:"4", full_name:"Samiha"  }, activity: { Mon:3,Tue:2,Wed:3,Thu:2,Fri:3,Sat:0,Sun:0 }, total:13 },
    { user: { id:"5", full_name:"Nila"    }, activity: { Mon:1,Tue:0,Wed:0,Thu:1,Fri:0,Sat:0,Sun:0 }, total:2  },
  ],
  contribution_share: [
    { user: { id:"1", full_name:"Anushka" }, percentage:35 },
    { user: { id:"2", full_name:"Tahmina" }, percentage:15 },
    { user: { id:"3", full_name:"Parisa"  }, percentage:34 },
    { user: { id:"4", full_name:"Samiha"  }, percentage:10 },
    { user: { id:"5", full_name:"Nila"    }, percentage:10 },
  ],
  inactive_members: [{ id:"5", full_name:"Nila" }],
  stats: { active_members:4, total_members:5, total_actions:124, most_active_day:"Wednesday" },
};

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

export default function HeatmapPage() {
  const [data] = useState(DUMMY);

  return (
    <div>
      <h2 style={{ marginBottom:4, fontFamily:"'Playfair Display',serif" }}>
        Team Collaboration Heatmap
      </h2>
      <p style={{ color:"#7A7063", fontSize:"0.88rem", marginBottom:20 }}>
        Visual activity breakdown for your project group
      </p>

      {data.inactive_members.length > 0 && (
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"#FEF3C7", border:"1px solid #F9C74F",
          borderRadius:10, padding:"10px 16px", marginBottom:20, flexWrap:"wrap", gap:8
        }}>
          <span style={{ fontSize:"0.85rem", color:"#78350F", fontWeight:500 }}>
            ⚠ {data.inactive_members.length} members have been inactive for 5+ days
          </span>
          <button style={{
            background:"#893941", color:"#fff", border:"none",
            borderRadius:999, padding:"6px 14px", fontSize:"0.8rem", cursor:"pointer"
          }}>
            Notify All
          </button>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20, alignItems:"start" }}>

        <div style={{ background:"#FDFAF7", border:"1px solid rgba(45,45,45,0.1)", borderRadius:16, padding:24 }}>
          <p style={{ fontSize:"0.78rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", color:"#7A7063", marginBottom:16 }}>
            Activity Grid
          </p>

          <div style={{ display:"grid", gridTemplateColumns:"80px repeat(7,1fr)", gap:6, overflowX:"auto" }}>
            <div />
            {data.date_cols.map((d,i) => (
              <div key={i} style={{ textAlign:"center", fontSize:"0.72rem", fontWeight:600, color:"#7A7063" }}>
                {d}
              </div>
            ))}
            {data.members.map(m => (
              <div key={m.user.id} style={{ display:"contents" }}>
                <div style={{ fontSize:"0.82rem", fontWeight:500, display:"flex", alignItems:"center" }}>
                  {m.user.full_name.split(" ")[0]}
                </div>
                {data.date_cols.map((d,i) => (
                  <div key={i} style={{
                    aspectRatio:"1", borderRadius:6,
                    background: getHeatColor(m.activity[d] || 0),
                    cursor:"pointer"
                  }} title={`${m.user.full_name} · ${d}: ${m.activity[d] || 0} actions`} />
                ))}
              </div>
            ))}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:14, flexWrap:"wrap" }}>
            <span style={{ fontSize:"0.75rem", color:"#7A7063" }}>Legend:</span>
            {[["#EAEAD8","None"],["#D4D994","Low"],["#A8AF4A","Med"],["#5E6623","High"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ width:14, height:14, borderRadius:3, background:c }} />
                <span style={{ fontSize:"0.75rem", color:"#7A7063" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:"#FDFAF7", border:"1px solid rgba(45,45,45,0.1)", borderRadius:16, padding:24 }}>
          <p style={{ fontSize:"0.78rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", color:"#7A7063", marginBottom:16 }}>
            Contribution Share
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {data.contribution_share.map((m,i) => (
              <div key={m.user.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{
                  width:28, height:28, borderRadius:"50%",
                  background:CONTRIB_COLORS[i], color:"#fff",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"0.75rem", fontWeight:600, flexShrink:0
                }}>
                  {getInitials(m.user.full_name)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:"0.85rem", fontWeight:500 }}>{m.user.full_name}</span>
                    <span style={{ fontSize:"0.82rem", fontWeight:600, color:"#893941" }}>{m.percentage}%</span>
                  </div>
                  <div style={{ height:6, background:"rgba(45,45,45,0.1)", borderRadius:999, marginTop:5, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:999, background:"linear-gradient(90deg,#893941,#CB7885)", width:`${m.percentage}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginTop:20 }}>
        {[
          { icon:"👥", value:`${data.stats.active_members}/${data.stats.total_members}`, label:"Active Members" },
          { icon:"⚡", value:data.stats.total_actions, label:"Total Actions" },
          { icon:"📅", value:data.stats.most_active_day, label:"Most Active Day" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#FDFAF7", border:"1px solid rgba(45,45,45,0.1)", borderRadius:16, padding:"20px 24px", display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:"rgba(137,57,65,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.2rem" }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize:"1.6rem", fontWeight:700, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:"0.8rem", color:"#7A7063", marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}