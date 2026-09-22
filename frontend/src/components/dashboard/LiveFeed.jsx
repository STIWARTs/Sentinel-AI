import { ArrowUpRight } from "lucide-react";

const events = [
  {
    severity: "Critical",
    type: "DDoS Attack",
    source: "192.168.1.25",
    destination: "192.168.1.1",
    time: "14:32:08",
    risk: 92,
  },
  {
    severity: "High",
    type: "Port Scan",
    source: "10.0.0.42",
    destination: "Internal Network",
    time: "14:29:51",
    risk: 81,
  },
  {
    severity: "High",
    type: "Brute Force",
    source: "10.0.0.17",
    destination: "10.0.0.8",
    time: "14:27:14",
    risk: 76,
  },
  {
    severity: "Medium",
    type: "Suspicious DNS",
    source: "10.0.0.31",
    destination: "DNS Server",
    time: "14:21:43",
    risk: 54,
  },
  {
    severity: "Low",
    type: "Unusual Traffic",
    source: "10.0.0.56",
    destination: "External",
    time: "14:18:02",
    risk: 32,
  },
];

export default function LiveFeed() {
  return (
    <section className="dashboard-panel live-feed">
      <div className="panel-header">
        <div>
          <h2>Live Security Events</h2>
          <p>Most recent detections from monitored traffic</p>
        </div>

        <button className="view-all-button">
          View all
          <ArrowUpRight size={13} />
        </button>
      </div>

      <div className="event-table-wrapper">
        <table className="event-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Detection</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Detected</th>
              <th>Risk</th>
            </tr>
          </thead>

          <tbody>
            {events.map((event) => (
              <tr key={`${event.source}-${event.time}`}>
                <td>
                  <span
                    className={`severity-badge ${event.severity.toLowerCase()}`}
                  >
                    <span className="severity-dot" />
                    {event.severity}
                  </span>
                </td>

                <td className="event-type">
                  {event.type}
                </td>

                <td className="mono">
                  {event.source}
                </td>

                <td className="destination">
                  {event.destination}
                </td>

                <td className="event-time">
                  {event.time}
                </td>

                <td>
                  <span
                    className={`risk-value ${
                      event.risk >= 80
                        ? "high"
                        : event.risk >= 50
                          ? "medium"
                          : "low"
                    }`}
                  >
                    {event.risk}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}