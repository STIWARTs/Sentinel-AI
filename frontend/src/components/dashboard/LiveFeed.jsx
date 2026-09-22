import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useWebSocket } from "../../hooks/useWebSocket";
import { apiGet, getWebSocketUrl } from "../../api/client";

function formatTime(value) {
  if (!value) return new Date().toLocaleTimeString([], { hour12: false });

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], { hour12: false });
  }

  return String(value);
}

export default function LiveFeed() {
  const { connected, lastMessage } = useWebSocket(getWebSocketUrl("/ws/live"));

  const [paused, setPaused] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [feedEvents, setFeedEvents] = useState([]);

  useEffect(() => {
    Promise.all([
      apiGet("/api/incidents"),
      apiGet("/api/dashboard/recent-flows"),
    ])
      .then(([incidentRows, flowRows]) => {
        setIncidents((incidentRows || []).slice(0, 5).map((incident) => ({
          id: incident.id,
          severity: incident.severity ?? "Medium",
          type: incident.title ?? incident.attack_chain ?? "Security Incident",
          source: incident.src_ip ?? "—",
          time: formatTime(incident.created_at),
        })));
        setFeedEvents((flowRows || []).slice(0, 8).map((flow) => ({
          time: formatTime(flow.timestamp),
          source: flow.src_ip ?? "—",
          destination: "Not provided",
          protocol: "Flow",
          status: flow.prediction !== "BENIGN" ? "Detected" : "Normal",
        })));
      })
      .catch(() => {
        setIncidents([]);
        setFeedEvents([]);
      });
  }, []);

  useEffect(() => {
    if (!lastMessage || paused) return;

    if (lastMessage.type === "flow_update") {
      const event = {
        time: formatTime(lastMessage.timestamp),
        source: lastMessage.src_ip ?? "—",
        destination: lastMessage.dst_ip ?? "Not provided",
        protocol: lastMessage.protocol ?? "Not provided",
        status:
          lastMessage.prediction && lastMessage.prediction !== "BENIGN"
            ? "Detected"
            : "Normal",
      };

      setFeedEvents((current) => [event, ...current].slice(0, 8));
    }

    if (lastMessage.type === "new_incident") {
      const incident = {
        id: lastMessage.incident_id,
        severity: lastMessage.severity ?? "Medium",
        type: lastMessage.title ?? "Security Incident",
        source: lastMessage.src_ip ?? "—",
        time: formatTime(lastMessage.timestamp),
      };

      setIncidents((current) => [incident, ...current].slice(0, 5));
    }
  }, [lastMessage, paused]);

  const connectionLabel = useMemo(() => {
    if (paused) return "Paused";
    return connected ? "Live" : "Disconnected";
  }, [connected, paused]);

  return (
    <section className="live-feed-section">

      <div className="live-feed-header">
        <div>
          <h2>Live Network Activity</h2>
          <p>Real-time events from the security monitoring pipeline</p>
        </div>

        <div className="live-feed-controls">
          <span
            className={`live-feed-status ${
              connected && !paused ? "connected" : ""
            }`}
          >
            <span className="live-feed-status-dot" />
            {connectionLabel}
          </span>

          <button
            type="button"
            className="live-feed-pause"
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>

      <div className="live-feed-grid">

        <div className="live-feed-panel">
          <div className="panel-header">
            <div>
              <h3>Recent Incidents</h3>
              <span>Latest detected security events</span>
            </div>

            <NavLink to="/incidents" className="panel-link">
              View all
              <ArrowUpRight size={14} />
            </NavLink>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Source IP</th>
                  <th>Time</th>
                </tr>
              </thead>

              <tbody>
                {incidents.length > 0 ? incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td className="mono">
                      INC-{incident.id}
                    </td>

                    <td>
                      <span
                        className={`severity-badge ${incident.severity.toLowerCase()}`}
                      >
                        {incident.severity}
                      </span>
                    </td>

                    <td>{incident.type}</td>

                    <td className="mono">
                      {incident.source}
                    </td>

                    <td className="mono">
                      {incident.time}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5">No live incidents received.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="live-feed-panel">
          <div className="panel-header">
            <div>
              <h3>Live Feed</h3>
              <span>Incoming network events</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Protocol</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {feedEvents.length > 0 ? feedEvents.map((event, index) => (
                  <tr key={`${event.time}-${event.source}-${index}`}>
                    <td className="mono">{event.time}</td>

                    <td className="mono">{event.source}</td>

                    <td className="mono">{event.destination}</td>

                    <td>
                      <span className="protocol-badge">
                        {event.protocol}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`feed-status ${event.status.toLowerCase()}`}
                      >
                        {event.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5">No live network events received.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}