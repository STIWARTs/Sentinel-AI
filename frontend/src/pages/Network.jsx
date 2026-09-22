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
            <strong>{events.length || "—"}</strong>
            <small>{events.length ? "Recent flow events" : "Awaiting live data"}</small>
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

          <div className="network-empty-state">
            <Activity size={25} />

            <h3>Waiting for network data</h3>

            <p>
              {events.length ? `${events.length} recent flow events received.` : "Live traffic information will appear here when the network monitoring pipeline is connected."}
            </p>
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

        <div className="network-empty-state compact">
          <NetworkIcon size={22} />

          <h3>No connection data available</h3>

          <p>
            Connection records will appear here once the capture
            agent is providing network telemetry.
          </p>
        </div>
      </section>

    </div>
  );
}