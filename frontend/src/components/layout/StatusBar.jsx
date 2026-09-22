import { useWebSocket } from "../../hooks/useWebSocket";
import { WS_URL } from "../../api/client";

export default function StatusBar() {
  const { connected } = useWebSocket(`${WS_URL}/ws/live`);

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        <span className="status-item">
          <span className="status-dot connected" />
          Capture Agent: Connected
        </span>

        <span className="status-item">
          <span className="status-dot connected" />
          Backend: {connected ? "Connected" : "Disconnected"}
        </span>

        <span className="status-item">
          <span className="status-dot connected" />
          Database: Connected
        </span>
      </div>

      <div className="status-bar-right">
        <span>2.4k packets/sec</span>
      </div>
    </footer>
  );
}