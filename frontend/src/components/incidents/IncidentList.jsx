import { useNavigate } from "react-router-dom";

export default function IncidentList({ incidents }) {
  const navigate = useNavigate();
  return (
    <div className="incident-table-wrapper">
      <table className="incident-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Severity</th>
            <th>Incident</th>
            <th>Source</th>
            <th>Target</th>
            <th>Detected</th>
            <th>Risk</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  {incidents.length > 0 ? (
    incidents.map((incident) => (
      <tr
        key={incident.id}
        className="incident-row"
        onClick={() => navigate(`/incidents/${incident.id}`)}
      >
        <td>{incident.id}</td>

        <td>
          <span
            className={`severity-badge severity-${(incident.severity || "low").toLowerCase()}`}
          >
            {incident.severity}
          </span>
        </td>

        <td>{incident.type}</td>

        <td>{incident.source}</td>

        <td>{incident.target}</td>

        <td>{incident.detected}</td>

        <td>
          <span className="risk-value">
            {incident.risk}
          </span>
        </td>

        <td>
          <span className="status-badge">
            {incident.status}
          </span>
        </td>
      </tr>
    ))
  ) : (
    <tr>
      <td colSpan="8">
        <div className="incident-empty-state">
          <strong>No incidents found</strong>
          <span>
            Try adjusting your search or filters.
          </span>
        </div>
      </td>
    </tr>
  )}
</tbody>
      </table>
    </div>
  );
}