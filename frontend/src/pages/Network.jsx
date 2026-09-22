import {
  Activity,
  ArrowDown,
  ArrowUp,
  Network as NetworkIcon,
  Radio,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const trafficData = [
  { time: "14:00", inbound: 42, outbound: 28 },
  { time: "14:05", inbound: 51, outbound: 31 },
  { time: "14:10", inbound: 47, outbound: 35 },
  { time: "14:15", inbound: 63, outbound: 39 },
  { time: "14:20", inbound: 58, outbound: 42 },
  { time: "14:25", inbound: 72, outbound: 48 },
  { time: "14:30", inbound: 68, outbound: 44 },
  { time: "14:35", inbound: 81, outbound: 52 },
];

const networkEvents = [
  {
    time: "14:35:12",
    type: "TCP Connection",
    source: "10.0.0.42",
    destination: "192.168.1.10:443",
    protocol: "TCP",
    status: "Allowed",
  },
  {
    time: "14:34:48",
    type: "DNS Request",
    source: "10.0.0.31",
    destination: "8.8.8.8:53",
    protocol: "UDP",
    status: "Allowed",
  },
  {
    time: "14:33:21",
    type: "Connection Attempt",
    source: "10.0.0.17",
    destination: "192.168.1.20:22",
    protocol: "TCP",
    status: "Flagged",
  },
  {
    time: "14:32:56",
    type: "HTTP Request",
    source: "10.0.0.56",
    destination: "172.217.16.14:443",
    protocol: "TCP",
    status: "Allowed",
  },
];

export default function Network() {
  return (
    <div className="network-page">

      <div className="page-heading">
        <div>
          <h1>Network</h1>
          <p>
            Real-time network traffic and connection monitoring
          </p>
        </div>

        <div className="network-live-indicator">
          <span />
          Live monitoring
        </div>
      </div>

      <div className="network-summary-grid">

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <Activity size={18} />
          </div>

          <div>
            <span>Packets / sec</span>
            <strong>1,284</strong>
          </div>
        </div>

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <NetworkIcon size={18} />
          </div>

          <div>
            <span>Active connections</span>
            <strong>342</strong>
          </div>
        </div>

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <ArrowDown size={18} />
          </div>

          <div>
            <span>Inbound traffic</span>
            <strong>68.4 MB/s</strong>
          </div>
        </div>

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <ArrowUp size={18} />
          </div>

          <div>
            <span>Outbound traffic</span>
            <strong>44.2 MB/s</strong>
          </div>
        </div>

      </div>

      <section className="dashboard-panel network-chart-panel">

        <div className="panel-header">
          <div>
            <h2>Traffic Activity</h2>
            <p>Inbound and outbound traffic over time</p>
          </div>

          <Radio size={17} />
        </div>

        <div className="network-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-color)"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                tick={{
                  fill: "var(--text-muted)",
                  fontSize: 11,
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fill: "var(--text-muted)",
                  fontSize: 11,
                }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip />

              <Area
                type="linear"
                dataKey="inbound"
                stroke="var(--primary)"
                fill="none"
                strokeWidth={2}
              />

              <Area
                type="linear"
                dataKey="outbound"
                stroke="var(--text-secondary)"
                fill="none"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </section>

      <section className="dashboard-panel">

        <div className="panel-header">
          <div>
            <h2>Recent Network Events</h2>
            <p>Latest observed network activity</p>
          </div>
        </div>

        <div className="network-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Protocol</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {networkEvents.map((event) => (
                <tr key={`${event.time}-${event.source}`}>
                  <td>{event.time}</td>
                  <td>{event.type}</td>
                  <td>{event.source}</td>
                  <td>{event.destination}</td>
                  <td>{event.protocol}</td>
                  <td>
                    <span
                      className={
                        event.status === "Flagged"
                          ? "network-status flagged"
                          : "network-status"
                      }
                    >
                      {event.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </section>

    </div>
  );
}