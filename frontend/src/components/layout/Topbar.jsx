import { Square } from "lucide-react";
import { useLocation } from "react-router-dom";

const pageMeta = {
  "/": {
    title: "Dashboard",
    subtitle: "Live view of your network activity, detected threats and system status.",
  },
  "/incidents": {
    title: "Incidents",
    subtitle: "All detected security incidents across your monitored network.",
  },
  "/network": {
    title: "Network",
    subtitle: "Live network topology and traffic analysis.",
  },
  "/copilot": {
    title: "AI Copilot",
    subtitle: "Conversational AI assistant for threat investigation.",
  },
  "/reports": {
    title: "Reports",
    subtitle: "Security reports and historical analytics.",
  },
};

export default function Topbar() {
  const { pathname } = useLocation();
  const meta = pageMeta[pathname] ?? { title: "Sentinel AI", subtitle: "" };

  // Static "since" date for demo
  const since = "12 Aug 2025, 10:24";

  return (
    <header className="topbar">

      <div className="topbar-left">
        <h2 className="topbar-title">
          {meta.title}
        </h2>
        <p className="topbar-subtitle">
          {meta.subtitle}
        </p>
      </div>

      <div className="topbar-right">

        {/* Monitoring status */}
        <div className="monitoring-status">
          <span className="monitoring-dot" />
          <div className="monitoring-info">
            <span className="monitoring-label">Monitoring Active</span>
            <span className="monitoring-since">Since {since}</span>
          </div>
        </div>

        {/* Stop Capture */}
        <button className="stop-capture-btn" id="stop-capture-button">
          <Square size={12} fill="currentColor" />
          Stop Capture
        </button>

      </div>
    </header>
  );
}