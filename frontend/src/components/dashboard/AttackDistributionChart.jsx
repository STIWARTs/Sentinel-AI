import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

const data = [
  { name: "DDoS", value: 31 },
  { name: "Port Scan", value: 24 },
  { name: "Brute Force", value: 18 },
  { name: "Other", value: 59 },
];

const COLORS = [
  "#b45309",
  "#7c3aed",
  "#d97706",
  "#cbd5e1",
];

export default function AttackDistributionChart() {
  return (
    <section className="dashboard-panel attack-distribution">
      <div className="panel-header">
        <div>
          <h2>Attack Distribution</h2>
          <p>Detected events by attack type</p>
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
                innerRadius="62%"
                outerRadius="82%"
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[index]}
                  />
                ))}
              </Pie>

              <Tooltip
                contentStyle={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  background: "#ffffff",
                  fontSize: "11px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="distribution-list">
          {data.map((item, index) => (
            <div
              key={item.name}
              className="distribution-item"
            >
              <span
                className="distribution-marker"
                style={{
                  background: COLORS[index],
                }}
              />

              <span className="distribution-name">
                {item.name}
              </span>

              <span className="distribution-value">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}