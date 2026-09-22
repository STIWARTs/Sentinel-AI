import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

const data = [
  { name: "DDoS", value: 32 },
  { name: "Port Scan", value: 24 },
  { name: "Brute Force", value: 18 },
  { name: "SQL Injection", value: 12 },
  { name: "Malware", value: 8 },
  { name: "Others", value: 6 },
];

const COLORS = [
  "#dc2626",  // red — DDoS
  "#f97316",  // orange — Port Scan
  "#eab308",  // yellow — Brute Force
  "#16a34a",  // green — SQL Injection
  "#7c3aed",  // purple — Malware
  "#94a3b8",  // grey — Others
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{payload[0].name}</p>
        <p className="chart-tooltip-row" style={{ color: payload[0].payload.fill }}>
          {payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

export default function AttackDistributionChart() {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <section className="dashboard-panel attack-distribution">
      <div className="panel-header">
        <div>
          <h2>Attack Type Distribution</h2>
          <p>Last 24 Hours</p>
        </div>
      </div>

      <div className="distribution-content">
        <div className="distribution-chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="78%"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[index]}
                  />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="distribution-list">
          {data.map((item, index) => (
            <div key={item.name} className="distribution-item">
              <span
                className="distribution-marker"
                style={{ background: COLORS[index] }}
              />

              <span className="distribution-name">
                {item.name}
              </span>

              <span className="distribution-value">
                {item.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}