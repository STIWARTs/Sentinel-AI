import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Clock, Activity } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "../api/client";

const STATUS_OPTIONS = [
  { value: "Open", label: "Open" },
  { value: "In Progress", label: "Investigating" },
  { value: "Resolved", label: "Resolved" },
];

function formatWhen(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString();
}

function displayStatus(status) {
  if (status === "In Progress") return "Investigating";
  return status || "Open";
}

function usernameFromToken() {
  const token = localStorage.getItem("sentinel_token");
  if (!token) return "analyst";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || "analyst";
  } catch {
    return "analyst";
  }
}

export default function IncidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [actionText, setActionText] = useState("");
  const [actions, setActions] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (!id) return undefined;
    setLoading(true);
    setActions([]);
    apiGet(`/api/incidents/${id}`)
      .then((row) => {
        setIncident(row);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch incident:", err);
        setIncident(null);
        setLoading(false);
      });
  }, [id]);

  async function handleStatusChange(event) {
    const status = event.target.value;
    setStatusError(null);
    setStatusBusy(true);
    try {
      const updated = await apiPatch(`/api/incidents/${id}/status`, { status });
      setIncident(updated);
    } catch (err) {
      console.error("Failed to update incident status:", err);
      setStatusError("Could not update status. Analyst role required.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleAddAction(event) {
    event.preventDefault();
    const action = actionText.trim();
    if (!action) return;

    setActionError(null);
    setActionBusy(true);
    try {
      const created = await apiPost(`/api/incidents/${id}/actions`, {
        action,
        performed_by: usernameFromToken(),
      });
      setActions((prev) => [created, ...prev]);
      setActionText("");
    } catch (err) {
      console.error("Failed to add incident action:", err);
      setActionError("Could not add action. Analyst role required.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <h2>Loading incident…</h2>
      </div>
    );
  }

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

  const severity = incident.severity ?? "Low";
  const attackChain = incident.attack_chain ?? incident.title ?? "Unknown";
  const risk = incident.risk_score ?? 0;
  const source = incident.src_ip ?? "—";

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
            INC-{incident.id}
          </div>

          <h1>{incident.title || attackChain}</h1>

          <p>
            {attackChain}
          </p>
        </div>

        <div className="incident-header-actions">
          <span
            className={`severity-badge severity-${severity.toLowerCase()}`}
          >
            {severity}
          </span>

          <select
            className="filter-select"
            value={incident.status ?? "Open"}
            onChange={handleStatusChange}
            disabled={statusBusy}
            aria-label="Incident status"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusError && <p className="detail-inline-error">{statusError}</p>}

      <div className="incident-overview-grid">

        <div className="detail-card">
          <div className="detail-card-label">
            Risk Score
          </div>

          <div className="risk-score">
            {risk}
            <span>/100</span>
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-card-label">
            Source
          </div>

          <div className="detail-card-value">
            {source}
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-card-label">
            MITRE Technique
          </div>

          <div className="detail-card-value">
            {incident.mitre_technique || "—"}
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-card-label">
            Detected
          </div>

          <div className="detail-card-value">
            {formatWhen(incident.created_at)}
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
                <span>{formatWhen(incident.created_at)}</span>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker">
                <ShieldAlert size={14} />
              </div>

              <div>
                <strong>Attack chain classified</strong>
                <span>
                  {attackChain} · {severity}
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
                  Risk score: {risk}/100
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
              <strong>{source}</strong>
            </div>

            <div className="evidence-row">
              <span>Attack chain</span>
              <strong>{attackChain}</strong>
            </div>

            <div className="evidence-row">
              <span>MITRE technique</span>
              <strong>{incident.mitre_technique || "—"}</strong>
            </div>

            <div className="evidence-row">
              <span>Severity</span>
              <strong>{severity}</strong>
            </div>

            <div className="evidence-row">
              <span>Status</span>
              <strong>{displayStatus(incident.status)}</strong>
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
          {incident.ai_explanation ? (
            <p>{incident.ai_explanation}</p>
          ) : (
            <p>
              Sentinel AI identified this event as a{" "}
              <strong>{severity.toLowerCase()}</strong>{" "}
              severity <strong>{attackChain}</strong> involving{" "}
              <strong>{source}</strong>. The current risk score is{" "}
              <strong>{risk}/100</strong>.
            </p>
          )}
        </div>

      </section>

      <section className="dashboard-panel">
        <div className="panel-header">
          <div>
            <h2>Analyst Actions</h2>
            <p>Log response steps taken on this incident</p>
          </div>
        </div>

        <form className="incident-action-form" onSubmit={handleAddAction}>
          <textarea
            className="incident-action-input"
            rows={3}
            placeholder="Describe the action taken (e.g. blocked source IP at firewall)"
            value={actionText}
            onChange={(event) => setActionText(event.target.value)}
          />
          <div className="incident-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={actionBusy || !actionText.trim()}
            >
              {actionBusy ? "Saving…" : "Add Action"}
            </button>
          </div>
        </form>

        {actionError && <p className="detail-inline-error">{actionError}</p>}

        <div className="action-log">
          {actions.length === 0 ? (
            <p className="action-log-empty">No actions logged this session.</p>
          ) : (
            actions.map((entry) => (
              <div className="action-log-row" key={entry.id}>
                <strong>{entry.action}</strong>
                <span>
                  {entry.performed_by} · {formatWhen(entry.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

    </div>
  );
}
