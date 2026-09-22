const summaryData = [
  {
    label: "Active Alerts",
    value: "132",
    detail: "+18 today",
    type: "neutral",
  },
  {
    label: "Critical Threats",
    value: "5",
    detail: "2 unresolved",
    type: "critical",
  },
  {
    label: "Blocked Attacks",
    value: "48",
    detail: "Last 24 hours",
    type: "success",
  },
  {
    label: "Monitored Devices",
    value: "103",
    detail: "2 require attention",
    type: "warning",
  },
];

export default function SummaryCards() {
  return (
    <section className="summary-grid">
      {summaryData.map((item) => (
        <div
          key={item.label}
          className={`summary-item ${item.type}`}
        >
          <div className="summary-label">
            {item.label}
          </div>

          <div className="summary-main">
            <span className="summary-value">
              {item.value}
            </span>

            <span className="summary-detail">
              {item.detail}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}