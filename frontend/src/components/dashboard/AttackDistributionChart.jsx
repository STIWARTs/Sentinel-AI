import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

// Static colors for chart slices
const COLORS = [
  "#dc2626", // red — DDoS
  "#f97316", // orange — Port Scan
  "#eab308", // yellow — Brute Force
  "#16a34a", // green — SQL Injection
  "#7c3aed", // purple — Malware
  "#94a3b8", // grey — Others
];

// Tooltip component – unchanged
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
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/dashboard/attack-distribution")
      .then((resp) => {
        // Expected format: { "DDoS": 31, "PortScan": 24, ... }
        const entries = Object.entries(resp).map(([name, value]) => ({ name, value }));
        setData(entries);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch attack distribution:", err);
        setError(err);
        setLoading(false);
      });
  }, []);

  // Fallback static data while loading/error
  const fallbackData = [
    { name: "DDoS", value: 0 },
    { name: "Port Scan", value: 0 },
    { name: "Brute Force", value: 0 },
    { name: "SQL Injection", value: 0 },
    { name: "Malware", value: 0 },
    { name: "Others", value: 0 },
  ];

  const chartData = loading || error ? fallbackData : data;

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

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
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="78%"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="distribution-list">
          {chartData.map((item, index) => (
            <div key={item.name} className="distribution-item">
              <span
                className="distribution-marker"
                style={{ background: COLORS[index % COLORS.length] }}
              />

              <span className="distribution-name">{item.name}</span>

              <span className="distribution-value">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}