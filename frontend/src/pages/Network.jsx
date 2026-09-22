import {
  Activity,
  Globe,
  Network as NetworkIcon,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { apiGet, getWebSocketUrl } from "../api/client";

export default function Network() {
  const { connected, lastMessage } = useWebSocket(getWebSocketUrl("/ws/live"));
  const [events, setEvents] = useState([]);

  useEffect(() => {
    apiGet("/api/dashboard/recent-flows")
      .then((flows) => setEvents(Array.isArray(flows) ? flows : []))
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    if (lastMessage?.type !== "flow_update") return;
    setEvents((current) => [lastMessage, ...current].slice(0, 50));
  }, [lastMessage]);

  const deviceCount = useMemo(
    () => new Set(events.map((event) => event.src_ip).filter(Boolean)).size,
    [events],
  );
  const totalBytes = events.reduce((sum, event) => sum + (Number(event.bytes) || 0), 0);
  const connectionRows = useMemo(() => {
    const grouped = new Map();
    events.forEach((event) => {
      if (!event.src_ip) return;
      const current = grouped.get(event.src_ip) || {
        source: event.src_ip,
        events: 0,
        lastSeen: event.timestamp,
        prediction: event.prediction,
      };
      current.events += 1;
      if (new Date(event.timestamp) > new Date(current.lastSeen)) {
        current.lastSeen = event.timestamp;
        current.prediction = event.prediction;
      }
      grouped.set(event.src_ip, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.events - a.events);
  }, [events]);

  function formatTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleTimeString([], { hour12: false });
  }

  return (
    <div className="network-page">

      <div className="page-heading">
        <div>
          <h1>Network Monitoring</h1>
          <p>
            Monitor network activity, connections, and traffic events.
          </p>
        </div>

        <div className="network-live-status">
          <span className="network-status-dot" />
          Monitoring
        </div>
      </div>

      <section className="network-summary-grid">

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <Activity size={19} />
          </div>

          <div>
            <span>Network Traffic</span>
            <strong>{totalBytes || "—"}</strong>
            <small>{events.length ? "Observed flow bytes" : "Awaiting live data"}</small>
          </div>
        </div>

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <NetworkIcon size={19} />
          </div>

          <div>
            <span>Active Connections</span>
            <strong>{connectionRows.length || "—"}</strong>
            <small>{connectionRows.length ? "Recent source connections" : "Awaiting live data"}</small>
          </div>
        </div>

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <Server size={19} />
          </div>

          <div>
            <span>Monitored Devices</span>
            <strong>{deviceCount || "—"}</strong>
            <small>{deviceCount ? "Observed source IPs" : "Awaiting live data"}</small>
          </div>
        </div>

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <ShieldCheck size={19} />
          </div>

          <div>
            <span>Network Status</span>
            <strong>{connected ? "Live" : "Disconnected"}</strong>
            <small>{connected ? "Receiving telemetry" : "WebSocket unavailable"}</small>
          </div>
        </div>

      </section>

      <section className="network-main-grid">

        <div className="dashboard-panel network-traffic-panel">
          <div className="panel-header">
            <div>
              <h2>Traffic Activity</h2>
              <span>Recent network traffic</span>
            </div>
          </div>

          <div className="network-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source IP</th>
                  <th>Prediction</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {events.length ? events.slice(0, 10).map((event, index) => (
                  <tr key={`${event.id || event.timestamp}-${index}`}>
                    <td>{formatTime(event.timestamp)}</td>
                    <td>{event.src_ip || "-"}</td>
                    <td>{event.prediction || "-"}</td>
                    <td>{event.risk_score ?? "-"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="4">No recent traffic data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Protocol Activity</h2>
              <span>Detected network protocols</span>
            </div>
          </div>

          <div className="protocol-list">
            {[{ protocol: "Captured flows", value: events.length }].map((item) => (
              <div
                className="protocol-row"
                key={item.protocol}
              >
                <span className="protocol-name">
                  {item.protocol}
                </span>

                <div className="protocol-bar">
                  <div
                    className="protocol-bar-fill"
                    style={{ width: `${item.value ? 100 : 0}%` }}
                  />
                </div>

                <span className="protocol-value">
                  {item.value || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

      </section>

      <section className="dashboard-panel network-connections-panel">
        <div className="panel-header">
          <div>
            <h2>Active Connections</h2>
            <span>
              Current network sessions observed by Sentinel
            </span>
          </div>

          <Globe size={18} />
        </div>

        <div className="network-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source IP</th>
                <th>Recent Events</th>
                <th>Last Seen</th>
                <th>Latest Prediction</th>
              </tr>
            </thead>
            <tbody>
              {connectionRows.length ? connectionRows.map((connection) => (
                <tr key={connection.source}>
                  <td>{connection.source}</td>
                  <td>{connection.events}</td>
                  <td>{formatTime(connection.lastSeen)}</td>
                  <td>{connection.prediction || "-"}</td>
                </tr>
              )) : (
                <tr><td colSpan="4">No recent source connections available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}