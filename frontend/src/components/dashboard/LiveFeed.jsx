import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiGet, WS_URL } from "../../api/client";
import { useWebSocket } from "../../hooks/useWebSocket";

const MAX_FEED = 40;
const MAX_INCIDENTS = 8;

function formatClock(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour12: false });
}

function normalizeStatus(status) {
  if (status === "In Progress") return "Investigating";
  return status || "Open";
}

function mapIncidentRow(inc) {
  return {
    id: inc.id,
    time: formatClock(inc.created_at),
    type: inc.attack_chain ?? inc.title ?? "Unknown",
    source: inc.src_ip ?? "—",
    destination: "—",
    severity: inc.severity ?? "Low",
    status: normalizeStatus(inc.status),
  };
}

function sourceFromIncidentTitle(title) {
  if (!title || !title.includes(" from ")) return "—";
  return title.split(" from ").pop();
}

const topIPs = [
  { ip: "192.168.1.25", packets: "1,240,532", pct: 28 },
  { ip: "203.45.67.89", packets: "892,114", pct: 20 },
  { ip: "185.199.110.23", packets: "652,421", pct: 15 },
  { ip: "10.10.5.4", packets: "421,903", pct: 9 },
  { ip: "45.33.12.14", packets: "391,221", pct: 8 },
];

const protocolColors = {
  TCP:  { bg: "#eff6ff", color: "#2563eb" },
  SSH:  { bg: "#f0fdf4", color: "#16a34a" },
  UDP:  { bg: "#fef9c3", color: "#a16207" },
  HTTP: { bg: "#fef2f2", color: "#dc2626" },
};

const severityClass = {
  Critical: "sev-critical",
  High: "sev-high",
  Medium: "sev-medium",
  Low: "sev-low",
};

const statusClass = {
  Open: "stat-open",
  Investigating: "stat-investigating",
  Resolved: "stat-resolved",
};

export default function LiveFeed() {
  const navigate = useNavigate();
  const { connected, lastMessage } = useWebSocket(`${WS_URL}/ws/live`);
  const [incidents, setIncidents] = useState([]);
  const [liveFeedEvents, setLiveFeedEvents] = useState([]);
  const [paused, setPaused] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const pausedRef = useRef(false);
  const feedSeq = useRef(0);

  pausedRef.current = paused;

  useEffect(() => {
    apiGet("/api/incidents")
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        setIncidents(rows.slice(0, MAX_INCIDENTS).map(mapIncidentRow));
      })
      .catch((err) => {
        console.error("Failed to fetch recent incidents:", err);
      });
  }, []);

  useEffect(() => {
    if (!lastMessage?.type) return;

    if (lastMessage.type === "flow_update") {
      if (pausedRef.current) return;

      const event = {
        id: `flow-${++feedSeq.current}`,
        time: formatClock(),
        source: lastMessage.src_ip ?? "—",
        destination: "—",
        protocol: lastMessage.prediction || "TCP",
        size: "—",
        info: `${lastMessage.prediction ?? "flow"} · risk ${lastMessage.risk_score ?? "—"}`,
      };

      setLiveFeedEvents((prev) => [event, ...prev].slice(0, MAX_FEED));
      return;
    }

    if (lastMessage.type === "new_incident") {
      const row = {
        id: lastMessage.incident_id,
        time: formatClock(),
        type: lastMessage.title ?? "New incident",
        source: sourceFromIncidentTitle(lastMessage.title),
        destination: "—",
        severity: lastMessage.severity ?? "High",
        status: "Open",
      };

      setIncidents((prev) =>
        [row, ...prev.filter((item) => item.id !== row.id)].slice(0, MAX_INCIDENTS)
      );
      setFlashId(row.id);
    }
  }, [lastMessage]);

  useEffect(() => {
    if (flashId == null) return undefined;
    const timer = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(timer);
  }, [flashId]);

  return (
    <div className="livefeed-section">

      <div className="livefeed-row">

        <section className="dashboard-panel recent-incidents">
          <div className="panel-header">
            <div>
              <h2>Recent Incidents</h2>
            </div>
            <NavLink to="/incidents" className="view-all-button">
              View All <ArrowUpRight size={12} />
            </NavLink>
          </div>

          <div className="event-table-wrapper">
            <table className="event-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Source IP</th>
                  <th>Destination IP</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="feed-info">No incidents yet</td>
                  </tr>
                ) : (
                  incidents.map((inc) => (
                    <tr
                      key={inc.id ?? `${inc.source}-${inc.time}`}
                      className={`${inc.id != null ? "incident-row" : ""} ${flashId === inc.id ? "row-flash" : ""}`.trim()}
                      onClick={() => inc.id != null && navigate(`/incidents/${inc.id}`)}
                    >
                      <td className="mono">{inc.time}</td>
                      <td className="event-type">{inc.type}</td>
                      <td className="mono">{inc.source}</td>
                      <td className="mono">{inc.destination}</td>
                      <td>
                        <span className={`severity-pill ${severityClass[inc.severity] ?? "sev-low"}`}>
                          {inc.severity}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${statusClass[inc.status] ?? "stat-open"}`}>
                          {inc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-panel top-source-ips">
          <div className="panel-header">
            <div>
              <h2>Top Source IPs</h2>
              <p>Last 24 Hours</p>
            </div>
          </div>

          <div className="event-table-wrapper">
            <table className="event-table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Total Packets</th>
                  <th style={{ width: 120 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {topIPs.map((row) => (
                  <tr key={row.ip}>
                    <td className="mono">{row.ip}</td>
                    <td className="mono">{row.packets}</td>
                    <td>
                      <div className="ip-bar-cell">
                        <span className="ip-pct">{row.pct}%</span>
                        <div className="ip-bar-track">
                          <div
                            className="ip-bar-fill"
                            style={{ width: `${row.pct * 3}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      <section className="dashboard-panel live-network-feed">
        <div className="panel-header">
          <div>
            <h2>Live Network Feed</h2>
            <p>{connected ? "Streaming from /ws/live" : "Waiting for WebSocket…"}</p>
          </div>
          <button
            className="pause-button"
            type="button"
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={11} fill="currentColor" /> : <Pause size={11} fill="currentColor" />}
            {paused ? "Resume" : "Pause"}
          </button>
        </div>

        <div className="event-table-wrapper">
          <table className="event-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Source IP</th>
                <th>Destination IP</th>
                <th>Protocol</th>
                <th>Size</th>
                <th>Info</th>
              </tr>
            </thead>
            <tbody>
              {liveFeedEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="feed-info">
                    {paused ? "Feed paused" : "Waiting for flow updates…"}
                  </td>
                </tr>
              ) : (
                liveFeedEvents.map((ev) => {
                  const proto = protocolColors[ev.protocol] ?? { bg: "#f1f5f9", color: "#475569" };
                  return (
                    <tr key={ev.id}>
                      <td className="mono">{ev.time}</td>
                      <td className="mono">{ev.source}</td>
                      <td className="mono">{ev.destination}</td>
                      <td>
                        <span
                          className="proto-badge"
                          style={{ background: proto.bg, color: proto.color }}
                        >
                          {ev.protocol}
                        </span>
                      </td>
                      <td className="mono">{ev.size}</td>
                      <td className="feed-info">{ev.info}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
