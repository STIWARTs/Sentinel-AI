import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useEffect, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { apiGet, getWebSocketUrl } from "../../api/client";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color }} className="chart-tooltip-row">
            Risk score: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AttackTimeline() {
  const { lastMessage } = useWebSocket(getWebSocketUrl("/ws/live"));
  const [data, setData] = useState([]);

  useEffect(() => {
    apiGet("/api/dashboard/recent-flows")
      .then((flows) => setData((flows || []).slice().reverse().map((flow) => ({
        time: new Date(flow.timestamp).toLocaleTimeString([], { hour12: false }),
        bytes: Number(flow.risk_score) || 0,
      })).slice(-8)))
      .catch(() => setData([]));
  }, []);

  useEffect(() => {
    if (lastMessage?.type !== "flow_update") return;
    setData((current) => [
      ...current,
      {
        time: new Date(lastMessage.timestamp).toLocaleTimeString([], { hour12: false }),
        bytes: Number(lastMessage.bytes) || 0,
      },
    ].slice(-8));
  }, [lastMessage]);

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
            Flow risk score
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
              tickFormatter={(v) => `${v}`}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="bytes"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#inboundGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}