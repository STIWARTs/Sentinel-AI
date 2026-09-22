import {
  Download,
  FileText,
  Calendar,
  ShieldAlert,
  Activity,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

export default function Reports() {
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/incidents")
      .then((rows) => setIncidents(Array.isArray(rows) ? rows : []))
      .catch(setError);
  }, []);

  const reports = incidents.slice(0, 10).map((incident) => ({
    id: `INC-${incident.id}`,
    name: incident.title,
    period: new Date(incident.created_at).toLocaleDateString(),
    type: incident.attack_chain,
    incidents: 1,
    generated: new Date(incident.created_at).toLocaleTimeString([], { hour12: false }),
    incident,
  }));

  function downloadJson(value, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="reports-page">

      <div className="page-heading">
        <div>
          <h1>Reports</h1>
          <p>
            Security activity summaries and investigation reports
          </p>
        </div>

        <button className="primary-button" onClick={() => downloadJson(incidents, "sentinel-incidents-report.json")} disabled={!incidents.length}>
          <FileText size={15} />
          Generate report
        </button>
      </div>

      <div className="report-summary-grid">

        <div className="report-summary-card">
          <div className="report-summary-icon">
            <FileText size={18} />
          </div>

          <div>
            <span>Reports generated</span>
            <strong>{incidents.length}</strong>
          </div>
        </div>

        <div className="report-summary-card">
          <div className="report-summary-icon">
            <ShieldAlert size={18} />
          </div>

          <div>
            <span>Incidents analyzed</span>
            <strong>{incidents.length}</strong>
          </div>
        </div>

        <div className="report-summary-card">
          <div className="report-summary-icon">
            <Activity size={18} />
          </div>

          <div>
            <span>Threat events</span>
            <strong>{incidents.length}</strong>
          </div>
        </div>

      </div>

      <section className="dashboard-panel">

        <div className="panel-header">
          <div>
            <h2>Generated Reports</h2>
            <p>Recently created security reports</p>
          </div>
        </div>

        <div className="reports-table-wrapper">
          <table className="data-table">

            <thead>
              <tr>
                <th>Report</th>
                <th>Type</th>
                <th>Period</th>
                <th>Incidents</th>
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {error ? (
                <tr><td colSpan="6">Unable to load incident reports.</td></tr>
              ) : reports.length ? reports.map((report) => (
                <tr key={report.id}>

                  <td>
                    <div className="report-name">
                      <strong>{report.name}</strong>
                      <span>{report.id}</span>
                    </div>
                  </td>

                  <td>{report.type}</td>

                  <td>
                    <div className="report-period">
                      <Calendar size={13} />
                      {report.period}
                    </div>
                  </td>

                  <td>{report.incidents}</td>

                  <td>{report.generated}</td>

                  <td>
                    <button
                      className="report-download"
                      title="Download report"
                      onClick={() => downloadJson(report.incident, `${report.id.toLowerCase()}-report.json`)}
                    >
                      <Download size={15} />
                    </button>
                  </td>

                </tr>
              )) : (
                <tr><td colSpan="6">No incident reports available.</td></tr>
              )}
            </tbody>

          </table>
        </div>

      </section>

    </div>
  );
}