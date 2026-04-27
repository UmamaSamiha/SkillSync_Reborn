// Full Activity Grid component
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const colorMap = {
  none: '#e8e8e8',
  low: '#c5d89a',
  medium: '#8fab4e',
  high: '#4a6741',
};

export default function HeatmapGrid({ members }) {
  // members = [{ name, avatar, activity: ['none','low','medium','high', ...7 days] }]
  return (
    <div className="heatmap-grid">
      <div className="grid-header">
        {DAYS.map(d => <span key={d}>{d}</span>)}
      </div>
      {members.map(member => (
        <div key={member.name} className="grid-row">
          <span className="member-name">{member.name}</span>
          {member.activity.map((level, i) => (
            <div
              key={i}
              className="grid-cell"
              style={{ backgroundColor: colorMap[level] }}
              title={`${member.name} - ${DAYS[i]}: ${level}`}
            />
          ))}
        </div>
      ))}
      <div className="legend">
        {Object.entries(colorMap).map(([label, color]) => (
          <span key={label}>
            <span style={{ background: color, display: 'inline-block', width: 12, height: 12 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}