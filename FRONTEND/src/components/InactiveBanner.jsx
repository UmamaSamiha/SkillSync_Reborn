// The pink warning banner + Notify All button
export default function InactiveBanner({ inactiveCount, onNotifyAll }) {
  if (!inactiveCount) return null;
  return (
    <div className="inactive-banner">
      <span>⚠️ {inactiveCount} members have been inactive for 5+ days</span>
      <button className="notify-all-btn" onClick={onNotifyAll}>
        Notify All
      </button>
    </div>
  );
}