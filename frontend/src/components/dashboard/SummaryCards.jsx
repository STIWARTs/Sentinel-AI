import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  Monitor,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

export default function SummaryCards() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/dashboard/summary")
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard summary:", err);
        setError(err);
        setLoading(false);
      });
  }, []);

  // Fallback static data while loading or on error
  const fallbackData = [
    { label: "Active Connections", value: "-", trend: "-", trendDir: "neutral", trendLabel: "", icon: Activity, iconColor: "#2563eb", iconBg: "#eff6ff" },
    { label: "Detected Threats", value: "-", trend: "-", trendDir: "neutral", trendLabel: "", icon: ShieldAlert, iconColor: "#dc2626", iconBg: "#fef2f2" },
    { label: "Active Devices", value: "-", trend: "-", trendDir: "neutral", trendLabel: "", icon: Monitor, iconColor: "#2563eb", iconBg: "#eff6ff" },
    { label: "Blocked Attacks", value: "-", trend: "-", trendDir: "neutral", trendLabel: "", icon: ShieldCheck, iconColor: "#16a34a", iconBg: "#f0fdf4" },
  ];

  const data = summary
    ? [
        {
          label: "Today's Alerts",
          value: summary.todays_alerts?.toString() ?? "-",
          trend: "",
          trendDir: "neutral",
          trendLabel: "",
          icon: Activity,
          iconColor: "#2563eb",
          iconBg: "#eff6ff",
        },
        {
          label: "Critical Threats",
          value: summary.critical_threats?.toString() ?? "-",
          trend: "",
          trendDir: "neutral",
          trendLabel: "",
          icon: ShieldAlert,
          iconColor: "#dc2626",
          iconBg: "#fef2f2",
        },
        {
          label: "Monitored Devices",
          value: "—",
          trend: "",
          trendDir: "neutral",
          trendLabel: "",
          icon: Monitor,
          iconColor: "#2563eb",
          iconBg: "#eff6ff",
        },
        {
          label: "Blocked Attacks",
          value: summary.blocked_attacks?.toString() ?? "-",
          trend: "",
          trendDir: "neutral",
          trendLabel: "",
          icon: ShieldCheck,
          iconColor: "#16a34a",
          iconBg: "#f0fdf4",
        },
      ]
    : fallbackData;

  return (
    <section className="summary-grid">
      {data.map((item) => {
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
                className={`summary-trend ${
                  item.trendDir === "up"
                    ? "trend-up"
                    : item.trendDir === "down"
                    ? "trend-down"
                    : "trend-neutral"
                }`}
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