import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useWebSocket } from "../../hooks/useWebSocket";
import { WS_URL } from "../../api/client";

const initialIncidents = [
  {
    id: "1042",
    severity: "Critical",
    type: "DDoS Attack",
    source: "192.168.1.25",
    time: "14:32:08",
  },
  {
    id: "1041",
    severity: "High",
    type: "Port Scan",
    source: "10.0.0.42",
    time: "14:29:51",
  },
  {
    id: "1040",
    severity: "High",
    type: "Brute Force",
    source: "10.0.0.17",
    time: "14:27:14",
  },
  {
    id: "1039",
    severity: "Medium",
    type: "Suspicious DNS",
    source: "10.0.0.31",
    time: "14:21:43",
  },
  {
    id: "1038",
    severity: "Low",
    type: "Unusual Traffic",
    source: "10.0.0.56",
    time: "14:18:02",
  },
];

const initialFeedEvents = [
  {
    time: "14:32:08",
    source: "192.168.1.25",
    destination: "192.168.1.1",
    protocol: "TCP",
    status: "Blocked",
  },
  {
    time: "14:31:44",
    source: "10.0.0.42",
    destination: "10.0.0.1",
    protocol: "TCP",
    status: "Detected",
  },
  {
    time: "14:30:21",
    source: "10.0.0.17",
    destination: "10.0.0.8",
    protocol: "SSH",
    status: "Detected",
  },
  {
    time: "14:29:58",
    source: "10.0.0.31",
    destination: "8.8.8.8",
    protocol: "DNS",
    status: "Normal",
  },
];

function formatTime(value) {
  if (!value) return new Date().toLocaleTimeString([], { hour12: false });

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], { hour12: false });
  }

  return String(value);
}

function severityFromRisk(risk) {
  const value = Number(risk ?? 0);

  if (value >= 90) return "Critical";
  if (value >= 70) return "High";
  if (value >= 40) return "Medium";
  return "Low";
}

export default function LiveFeed() {
  const { connected, lastMessage } = useWebSocket(`${WS_URL}/ws/live`);

  const [paused, setPaused] = useState(false);
  const [incidents, setIncidents] = useState(initialIncidents);
  const [feedEvents, setFeedEvents] = useState(initialFeedEvents);

  useEffect(() => {
    if (!lastMessage || paused) return;

    if (lastMessage.type === "flow_update") {
      const event = {
        time: formatTime(lastMessage.timestamp),
        source: lastMessage.src_ip ?? "—",
        destination: lastMessage.dst_ip ?? "—",
        protocol: lastMessage.protocol ?? "—",
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
        source: "—",
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
                {incidents.map((incident) => (
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
                ))}
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
                {feedEvents.map((event, index) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}