import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const data = [
  { time: "00:00", alerts: 4 },
  { time: "03:00", alerts: 7 },
  { time: "06:00", alerts: 5 },
  { time: "09:00", alerts: 12 },
  { time: "12:00", alerts: 9 },
  { time: "15:00", alerts: 18 },
  { time: "18:00", alerts: 14 },
  { time: "21:00", alerts: 11 },
];

export default function AttackTimeline() {
  return (
    <section className="dashboard-panel attack-timeline">
      <div className="panel-header">
        <div>
          <h2>Threat Activity</h2>
          <p>Detected security events over time</p>
        </div>

        <span className="panel-meta">
          24h
        </span>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient
                id="threatGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#b45309"
                  stopOpacity={0.18}
                />

                <stop
                  offset="100%"
                  stopColor="#b45309"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 10,
                fill: "#94a3b8",
              }}
            />

            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 10,
                fill: "#94a3b8",
              }}
              width={28}
            />

            <Tooltip
              contentStyle={{
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                background: "#ffffff",
                fontSize: "11px",
              }}
            />

            <Area
              type="linear"
              dataKey="alerts"
              stroke="#b45309"
              strokeWidth={2}
            //   fill="url(#threatGradient)"
            fill="none"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}