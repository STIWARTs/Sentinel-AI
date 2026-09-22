import { useMemo, useState } from "react";
import IncidentList from "../components/incidents/IncidentList";

export const incidents = [
  {
    id: "INC-1042",
    severity: "Critical",
    type: "DDoS Attack",
    source: "192.168.1.25",
    target: "192.168.1.1",
    detected: "14:32:08",
    risk: 92,
    status: "Open",
  },
  {
    id: "INC-1041",
    severity: "High",
    type: "Port Scan",
    source: "10.0.0.42",
    target: "Internal Network",
    detected: "14:29:51",
    risk: 81,
    status: "Investigating",
  },
  {
    id: "INC-1040",
    severity: "High",
    type: "Brute Force",
    source: "10.0.0.17",
    target: "10.0.0.8",
    detected: "14:27:14",
    risk: 76,
    status: "Open",
  },
  {
    id: "INC-1039",
    severity: "Medium",
    type: "Suspicious DNS",
    source: "10.0.0.31",
    target: "DNS Server",
    detected: "14:21:43",
    risk: 54,
    status: "Investigating",
  },
  {
    id: "INC-1038",
    severity: "Low",
    type: "Unusual Traffic",
    source: "10.0.0.56",
    target: "External",
    detected: "14:18:02",
    risk: 32,
    status: "Resolved",
  },
];

export default function Incidents() {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");
  const [status, setStatus] = useState("All");

  const filteredIncidents = useMemo(() => {
    const query = search.toLowerCase().trim();

    return incidents.filter((incident) => {
      const matchesSearch =
        !query ||
        incident.id.toLowerCase().includes(query) ||
        incident.type.toLowerCase().includes(query) ||
        incident.source.toLowerCase().includes(query) ||
        incident.target.toLowerCase().includes(query);

      const matchesSeverity =
        severity === "All" ||
        incident.severity === severity;

      const matchesStatus =
        status === "All" ||
        incident.status === status;

      return (
        matchesSearch &&
        matchesSeverity &&
        matchesStatus
      );
    });
  }, [search, severity, status]);

  return (
    <div className="incidents-page">

      <div className="page-heading">
        <div>
          <h1>Incidents</h1>

          <p>
            Detected security incidents requiring review
          </p>
        </div>

        <div className="incident-count">
          {filteredIncidents.length} of {incidents.length} incidents
        </div>
      </div>

      <div className="incident-toolbar">

        <input
          className="incident-search"
          type="text"
          placeholder="Search incidents..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        <select
          className="filter-select"
          value={severity}
          onChange={(event) =>
            setSeverity(event.target.value)
          }
        >
          <option value="All">All severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          className="filter-select"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
        >
          <option value="All">All statuses</option>
          <option value="Open">Open</option>
          <option value="Investigating">
            Investigating
          </option>
          <option value="Resolved">Resolved</option>
        </select>

      </div>

      <section className="dashboard-panel incident-panel">
        <IncidentList incidents={filteredIncidents} />
      </section>

    </div>
  );
}