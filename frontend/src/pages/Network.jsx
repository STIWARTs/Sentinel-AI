import {
  Activity,
  Globe,
  Network as NetworkIcon,
  Server,
  ShieldCheck,
} from "lucide-react";

const protocolData = [
  { protocol: "TCP", value: 0 },
  { protocol: "UDP", value: 0 },
  { protocol: "DNS", value: 0 },
  { protocol: "HTTP", value: 0 },
];

export default function Network() {
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
            <strong>—</strong>
            <small>Awaiting live data</small>
          </div>
        </div>

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <NetworkIcon size={19} />
          </div>

          <div>
            <span>Active Connections</span>
            <strong>—</strong>
            <small>Awaiting live data</small>
          </div>
        </div>

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <Server size={19} />
          </div>

          <div>
            <span>Monitored Devices</span>
            <strong>—</strong>
            <small>Awaiting live data</small>
          </div>
        </div>

        <div className="network-summary-card">
          <div className="network-summary-icon">
            <ShieldCheck size={19} />
          </div>

          <div>
            <span>Network Status</span>
            <strong>Normal</strong>
            <small>No active network alerts</small>
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
              Live traffic information will appear here when the
              network monitoring pipeline is connected.
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
            {protocolData.map((item) => (
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
                    style={{ width: `${item.value}%` }}
                  />
                </div>

                <span className="protocol-value">
                  —
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