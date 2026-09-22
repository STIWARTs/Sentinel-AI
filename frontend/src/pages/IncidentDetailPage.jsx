import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Clock, Activity } from "lucide-react";
import { incidents } from "./Incidents";

export default function IncidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const incident = incidents.find((item) => item.id === id);

  if (!incident) {
    return (
      <div className="empty-state">
        <h2>Incident not found</h2>
        <p>The requested incident does not exist.</p>

        <button
          className="back-button"
          onClick={() => navigate("/incidents")}
        >
          <ArrowLeft size={15} />
          Back to incidents
        </button>
      </div>
    );
  }

  return (
    <div className="incident-detail-page">

      <button
        className="back-button"
        onClick={() => navigate("/incidents")}
      >
        <ArrowLeft size={15} />
        Back to incidents
      </button>

      <div className="incident-detail-header">
        <div>
          <div className="incident-detail-id">
            {incident.id}
          </div>

          <h1>{incident.type}</h1>

          <p>
            Security incident detected by Sentinel AI
          </p>
        </div>

        <div className="incident-header-actions">
          <span
            className={`severity-badge severity-${incident.severity.toLowerCase()}`}
          >
            {incident.severity}
          </span>

          <span className="status-badge">
            {incident.status}
          </span>
        </div>
      </div>

      <div className="incident-overview-grid">

        <div className="detail-card">
          <div className="detail-card-label">
            Risk Score
          </div>

          <div className="risk-score">
            {incident.risk}
            <span>/100</span>
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-card-label">
            Source
          </div>

          <div className="detail-card-value">
            {incident.source}
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-card-label">
            Destination
          </div>

          <div className="detail-card-value">
            {incident.target}
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-card-label">
            Detected
          </div>

          <div className="detail-card-value">
            {incident.detected}
          </div>
        </div>

      </div>

      <div className="incident-analysis-grid">

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Detection Timeline</h2>
              <p>Events associated with this incident</p>
            </div>

            <Clock size={17} />
          </div>

          <div className="timeline">

            <div className="timeline-item">
              <div className="timeline-marker">
                <Activity size={14} />
              </div>

              <div>
                <strong>Suspicious activity detected</strong>
                <span>{incident.detected}</span>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker">
                <ShieldAlert size={14} />
              </div>

              <div>
                <strong>Threat classified</strong>
                <span>
                  {incident.type} · {incident.severity}
                </span>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker">
                <ShieldAlert size={14} />
              </div>

              <div>
                <strong>Risk assessment completed</strong>
                <span>
                  Risk score: {incident.risk}/100
                </span>
              </div>
            </div>

          </div>
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Evidence</h2>
              <p>Observed indicators</p>
            </div>
          </div>

          <div className="evidence-list">

            <div className="evidence-row">
              <span>Source IP</span>
              <strong>{incident.source}</strong>
            </div>

            <div className="evidence-row">
              <span>Destination</span>
              <strong>{incident.target}</strong>
            </div>

            <div className="evidence-row">
              <span>Detection type</span>
              <strong>{incident.type}</strong>
            </div>

            <div className="evidence-row">
              <span>Severity</span>
              <strong>{incident.severity}</strong>
            </div>

          </div>
        </section>

      </div>

      <section className="dashboard-panel ai-analysis-panel">

        <div className="panel-header">
          <div>
            <h2>AI Analysis</h2>
            <p>Automated threat assessment</p>
          </div>
        </div>

        <div className="ai-analysis-content">
          <p>
            Sentinel AI identified this event as a{" "}
            <strong>{incident.severity.toLowerCase()}</strong>{" "}
            severity <strong>{incident.type}</strong> involving{" "}
            <strong>{incident.source}</strong> and{" "}
            <strong>{incident.target}</strong>.
          </p>

          <p>
            The current risk score is{" "}
            <strong>{incident.risk}/100</strong>. Further
            investigation should consider the associated
            network activity and supporting evidence.
          </p>
        </div>

      </section>

      <div className="incident-actions">

        <button className="secondary-button">
          Mark as investigating
        </button>

        <button className="primary-button">
          Resolve incident
        </button>

      </div>

    </div>
  );
}