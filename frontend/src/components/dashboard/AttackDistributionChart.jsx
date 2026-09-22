import { useEffect, useState } from "react";
import { apiGet } from "../../api/client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

const COLORS = [
  "#dc2626",
  "#f97316",
  "#eab308",
  "#16a34a",
  "#7c3aed",
  "#94a3b8",
];

function formatAttackName(name) {
  if (!name) return "Unknown";

  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">
        {item.name}
      </p>

      <p className="chart-tooltip-row">
        {item.value} events ({item.percentage}%)
      </p>
    </div>
  );
};

export default function AttackDistributionChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/dashboard/attack-distribution")
      .then((response) => {
        if (!response || typeof response !== "object") {
          setData([]);
          setLoading(false);
          return;
        }

        const entries = Object.entries(response)
          .map(([name, value]) => ({
            name: formatAttackName(name),
            value: Number(value) || 0,
          }))
          .filter((item) => item.value > 0);

        const total = entries.reduce(
          (sum, item) => sum + item.value,
          0
        );

        const withPercentages = entries.map((item) => ({
          ...item,
          percentage:
            total > 0
              ? Math.round((item.value / total) * 100)
              : 0,
        }));

        setData(withPercentages);
        setLoading(false);
      })
      .catch((err) => {
        console.error(
          "Failed to fetch attack distribution:",
          err
        );
        setError(err);
        setLoading(false);
      });
  }, []);

  const fallbackData = [
    {
      name: "No threat data",
      value: 1,
      percentage: 0,
    },
  ];

  const chartData =
    loading || error || data.length === 0
      ? fallbackData
      : data;

  const total = data.reduce(
    (sum, item) => sum + item.value,
    0
  );

  return (
    <section className="dashboard-panel attack-distribution-panel">
      <div className="panel-header">
        <div>
          <h2>Attack Distribution</h2>
          <span>
            {loading
              ? "Loading threat data..."
              : `${total} detected attack events`}
          </span>
        </div>
      </div>

      <div className="attack-distribution-content">
        <div className="attack-distribution-chart">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>

              {!loading && !error && data.length > 0 && (
                <Tooltip content={<CustomTooltip />} />
              )}
            </PieChart>
          </ResponsiveContainer>

          {!loading && !error && data.length > 0 && (
            <div className="attack-distribution-total">
              <strong>{total}</strong>
              <span>Events</span>
            </div>
          )}
        </div>

        <div className="attack-distribution-legend">
          {data.map((item, index) => (
            <div
              className="attack-distribution-item"
              key={item.name}
            >
              <span
                className="attack-distribution-dot"
                style={{
                  backgroundColor:
                    COLORS[index % COLORS.length],
                }}
              />

              <span className="attack-distribution-name">
                {item.name}
              </span>

              <span className="attack-distribution-value">
                {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}