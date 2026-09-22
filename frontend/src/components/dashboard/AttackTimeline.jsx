import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const data = [
  { time: "10:20", inbound: 18, outbound: 8 },
  { time: "10:21", inbound: 28, outbound: 10 },
  { time: "10:21:30", inbound: 22, outbound: 9 },
  { time: "10:22", inbound: 35, outbound: 14 },
  { time: "10:22:30", inbound: 30, outbound: 12 },
  { time: "10:23", inbound: 42, outbound: 16 },
  { time: "10:23:30", inbound: 38, outbound: 15 },
  { time: "10:24", inbound: 55, outbound: 20 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color }} className="chart-tooltip-row">
            {p.dataKey === "inbound" ? "Inbound" : "Outbound"}: {p.value} Mbps
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AttackTimeline() {
  return (
    <section className="dashboard-panel attack-timeline">
      <div className="panel-header">
        <div>
          <h2>Network Traffic</h2>
          <p>Last 5 Minutes</p>
        </div>

        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "#2563eb" }} />
            Inbound
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "#16a34a" }} />
            Outbound
          </span>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="inboundGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="outboundGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
            />

            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              width={36}
              tickFormatter={(v) => `${v} Mbps`}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="inbound"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#inboundGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="outbound"
              stroke="#16a34a"
              strokeWidth={2}
              fill="url(#outboundGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}