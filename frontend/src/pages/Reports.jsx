import {
  Download,
  FileText,
  Calendar,
  ShieldAlert,
  Activity,
} from "lucide-react";

const reports = [
  {
    id: "RPT-2026-082",
    name: "Daily Security Summary",
    period: "Today",
    type: "Security Summary",
    incidents: 12,
    generated: "14:40:12",
  },
  {
    id: "RPT-2026-081",
    name: "Weekly Threat Analysis",
    period: "Aug 01 – Aug 07",
    type: "Threat Analysis",
    incidents: 48,
    generated: "Yesterday",
  },
  {
    id: "RPT-2026-080",
    name: "Network Activity Report",
    period: "Aug 07",
    type: "Network",
    incidents: 7,
    generated: "Yesterday",
  },
];

export default function Reports() {
  return (
    <div className="reports-page">

      <div className="page-heading">
        <div>
          <h1>Reports</h1>
          <p>
            Security activity summaries and investigation reports
          </p>
        </div>

        <button className="primary-button">
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
            <strong>24</strong>
          </div>
        </div>

        <div className="report-summary-card">
          <div className="report-summary-icon">
            <ShieldAlert size={18} />
          </div>

          <div>
            <span>Incidents analyzed</span>
            <strong>186</strong>
          </div>
        </div>

        <div className="report-summary-card">
          <div className="report-summary-icon">
            <Activity size={18} />
          </div>

          <div>
            <span>Threat events</span>
            <strong>1,842</strong>
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
              {reports.map((report) => (
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
                    >
                      <Download size={15} />
                    </button>
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