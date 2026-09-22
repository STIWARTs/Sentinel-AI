import { useEffect, useMemo, useState } from "react";
import IncidentList from "../components/incidents/IncidentList";
import { apiGet } from "../api/client";

function formatDetected(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleTimeString([], { hour12: false });
}

export function mapIncident(inc) {
  const status = inc.status === "In Progress" ? "Investigating" : inc.status;
  return {
    id: inc.id,
    severity: inc.severity ?? "Low",
    type: inc.attack_chain ?? inc.title ?? "Unknown",
    source: inc.src_ip ?? "—",
    target: "—",
    detected: formatDetected(inc.created_at),
    risk: inc.risk_score ?? 0,
    status: status ?? "Open",
  };
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");
  const [status, setStatus] = useState("All");

  useEffect(() => {
    apiGet("/api/incidents")
      .then((rows) => {
        setIncidents(Array.isArray(rows) ? rows.map(mapIncident) : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch incidents:", err);
        setError(err);
        setLoading(false);
      });
  }, []);

  const filteredIncidents = useMemo(() => {
    const query = search.toLowerCase().trim();

    return incidents.filter((incident) => {
      const matchesSearch =
        !query ||
        String(incident.id).toLowerCase().includes(query) ||
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
  }, [incidents, search, severity, status]);

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
          {loading
            ? "Loading…"
            : error
              ? "Unable to load incidents"
              : `${filteredIncidents.length} of ${incidents.length} incidents`}
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
