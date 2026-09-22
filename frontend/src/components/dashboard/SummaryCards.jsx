import {
  Activity,
  ShieldAlert,
  Monitor,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

const summaryData = [
  {
    label: "Active Connections",
    value: "128",
    trend: "+12%",
    trendDir: "up",
    trendLabel: "vs last hour",
    icon: Activity,
    iconColor: "#2563eb",
    iconBg: "#eff6ff",
  },
  {
    label: "Detected Threats",
    value: "24",
    trend: "+8%",
    trendDir: "up",
    trendLabel: "vs last hour",
    icon: ShieldAlert,
    iconColor: "#dc2626",
    iconBg: "#fef2f2",
  },
  {
    label: "Active Devices",
    value: "18",
    trend: "0%",
    trendDir: "neutral",
    trendLabel: "vs last hour",
    icon: Monitor,
    iconColor: "#2563eb",
    iconBg: "#eff6ff",
  },
  {
    label: "Blocked Attacks",
    value: "6",
    trend: "+50%",
    trendDir: "up",
    trendLabel: "vs last hour",
    icon: ShieldCheck,
    iconColor: "#16a34a",
    iconBg: "#f0fdf4",
  },
];

export default function SummaryCards() {
  return (
    <section className="summary-grid">
      {summaryData.map((item) => {
        const Icon = item.icon;
        const TrendIcon =
          item.trendDir === "up"
            ? TrendingUp
            : item.trendDir === "down"
              ? TrendingDown
              : Minus;

        return (
          <div key={item.label} className="summary-item">
            <div className="summary-top">
              <span className="summary-label">{item.label}</span>
              <div
                className="summary-icon"
                style={{ background: item.iconBg, color: item.iconColor }}
              >
                <Icon size={18} />
              </div>
            </div>

            <div className="summary-value">{item.value}</div>

            <div className="summary-footer">
              <span
                className={`summary-trend ${item.trendDir === "up" ? "trend-up" : item.trendDir === "down" ? "trend-down" : "trend-neutral"}`}
              >
                <TrendIcon size={11} />
                {item.trend}
              </span>
              <span className="summary-trend-label">{item.trendLabel}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}