import { ArrowUpRight, Pause } from "lucide-react";
import { NavLink } from "react-router-dom";

// ─── Recent Incidents ───────────────────────────────────────────────────────

const incidents = [
  {
    time: "10:24:12",
    type: "DDoS",
    source: "192.168.1.25",
    destination: "192.168.1.1",
    severity: "Critical",
    status: "Open",
  },
  {
    time: "10:23:41",
    type: "Port Scan",
    source: "203.45.67.89",
    destination: "Multiple",
    severity: "High",
    status: "Open",
  },
  {
    time: "10:22:18",
    type: "Brute Force",
    source: "185.199.110.23",
    destination: "192.168.1.10",
    severity: "High",
    status: "Investigating",
  },
  {
    time: "10:21:55",
    type: "SQL Injection",
    source: "45.33.12.14",
    destination: "192.168.1.20",
    severity: "Medium",
    status: "Open",
  },
  {
    time: "10:20:33",
    type: "Data Transfer",
    source: "10.10.5.4",
    destination: "172.16.0.8",
    severity: "Medium",
    status: "Investigating",
  },
];

// ─── Top Source IPs ─────────────────────────────────────────────────────────

const topIPs = [
  { ip: "192.168.1.25", packets: "1,240,532", pct: 28 },
  { ip: "203.45.67.89", packets: "892,114", pct: 20 },
  { ip: "185.199.110.23", packets: "652,421", pct: 15 },
  { ip: "10.10.5.4", packets: "421,903", pct: 9 },
  { ip: "45.33.12.14", packets: "391,221", pct: 8 },
];

// ─── Live Network Feed ───────────────────────────────────────────────────────

const liveFeedEvents = [
  {
    time: "10:24:18",
    source: "192.168.1.25",
    destination: "192.168.1.1",
    protocol: "TCP",
    size: "1.2 KB",
    info: "[SYN] High volume of SYN packets",
  },
  {
    time: "10:24:17",
    source: "203.45.67.89",
    destination: "192.168.1.10",
    protocol: "TCP",
    size: "800 B",
    info: "Port scan detected (multiple ports)",
  },
  {
    time: "10:24:15",
    source: "185.199.110.23",
    destination: "192.168.1.1",
    protocol: "SSH",
    size: "450 B",
    info: "Failed login attempt (user: root)",
  },
  {
    time: "10:24:12",
    source: "10.10.5.4",
    destination: "172.16.0.8",
    protocol: "UDP",
    size: "2.1 KB",
    info: "Unusual outbound data flow",
  },
  {
    time: "10:24:10",
    source: "45.33.12.14",
    destination: "192.168.1.20",
    protocol: "HTTP",
    size: "1.8 KB",
    info: "Suspicious payload detected",
  },
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

// ────────────────────────────────────────────────────────────────────────────

export default function LiveFeed() {
  return (
    <div className="livefeed-section">

      {/* ── Row 1: Recent Incidents + Top Source IPs ── */}
      <div className="livefeed-row">

        {/* Recent Incidents */}
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
                {incidents.map((inc) => (
                  <tr key={`${inc.source}-${inc.time}`}>
                    <td className="mono">{inc.time}</td>
                    <td className="event-type">{inc.type}</td>
                    <td className="mono">{inc.source}</td>
                    <td className="mono">{inc.destination}</td>
                    <td>
                      <span className={`severity-pill ${severityClass[inc.severity]}`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${statusClass[inc.status]}`}>
                        {inc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Source IPs */}
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

      {/* ── Row 2: Live Network Feed ── */}
      <section className="dashboard-panel live-network-feed">
        <div className="panel-header">
          <div>
            <h2>Live Network Feed</h2>
          </div>
          <button className="pause-button" id="pause-feed-button">
            <Pause size={11} fill="currentColor" />
            Pause
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
              {liveFeedEvents.map((ev) => {
                const proto = protocolColors[ev.protocol] ?? { bg: "#f1f5f9", color: "#475569" };
                return (
                  <tr key={`${ev.source}-${ev.time}`}>
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
              })}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}