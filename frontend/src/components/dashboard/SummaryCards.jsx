import { useEffect, useState } from "react";
import { apiGet } from "../../api/client";
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  Monitor,
  Minus,
} from "lucide-react";

export default function SummaryCards() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    apiGet("/api/dashboard/summary")
      .then((data) => {
        if (mounted) {
          setSummary(data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard summary:", err);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const data = [
    {
      label: "Today's Alerts",
      value: summary?.todays_alerts ?? "—",
      icon: Activity,
      iconColor: "#b45309",
      iconBg: "#fff7ed",
    },
    {
      label: "Critical Threats",
      value: summary?.critical_threats ?? "—",
      icon: ShieldAlert,
      iconColor: "#dc2626",
      iconBg: "#fef2f2",
    },
    {
      label: "Monitored Devices",
      value: "—",
      icon: Monitor,
      iconColor: "#b45309",
      iconBg: "#fff7ed",
    },
    {
      label: "Blocked Attacks",
      value: summary?.blocked_attacks ?? "—",
      icon: ShieldCheck,
      iconColor: "#16a34a",
      iconBg: "#f0fdf4",
    },
  ];

  return (
    <section className="summary-grid">
      {data.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.label} className="summary-item">
            <div className="summary-top">
              <span className="summary-label">{item.label}</span>

              <div
                className="summary-icon"
                style={{
                  background: item.iconBg,
                  color: item.iconColor,
                }}
              >
                <Icon size={18} />
              </div>
            </div>

            <div className="summary-value">
              {loading ? "…" : item.value}
            </div>

            <div className="summary-footer">
              <span className="summary-trend trend-neutral">
                <Minus size={11} />
              </span>

              <span className="summary-trend-label">
                {item.label === "Monitored Devices"
                  ? "Not available from backend"
                  : "Current total"}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}