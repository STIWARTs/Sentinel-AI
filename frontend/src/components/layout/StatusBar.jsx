export default function StatusBar() {
  const now = new Date();
  const timeStr = now.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <footer className="statusbar" id="app-statusbar">
      <div className="statusbar-left">
        <span className="status-indicator connected">
          <span className="status-pip" />
          Capture Agent: Connected
        </span>
        <span className="status-indicator connected">
          <span className="status-pip" />
          Backend: Connected
        </span>
        <span className="status-indicator connected">
          <span className="status-pip" />
          Database: Connected
        </span>
      </div>

      <div className="statusbar-right">
        <span className="status-pps">2.4k packets/sec</span>
        <span className="status-time">{timeStr}</span>
      </div>
    </footer>
  );
}
