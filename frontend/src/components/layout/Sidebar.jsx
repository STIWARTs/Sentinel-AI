import {
  LayoutDashboard,
  Network,
  ShieldAlert,
  FileText,
  Bot,
  Settings,
} from "lucide-react";

const navigation = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/",
  },
  {
    label: "Network",
    icon: Network,
    path: "/network",
  },
  {
    label: "Incidents",
    icon: ShieldAlert,
    path: "/incidents",
  },
  {
    label: "Reports",
    icon: FileText,
    path: "/reports",
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          S
        </div>

        <div>
          <div className="brand-name">
            Sentinel AI
          </div>

          <div className="brand-subtitle">
            Security Operations
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">
          MONITOR
        </div>

        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <a
              key={item.path}
              href={item.path}
              className={`nav-item ${
                item.path === "/"
                  ? "active"
                  : ""
              }`}
            >
              <Icon size={18} />

              <span>{item.label}</span>
            </a>
          );
        })}

        <div className="nav-section-title">
          ASSIST
        </div>

        <a href="/copilot" className="nav-item">
          <Bot size={18} />

          <span>AI Copilot</span>
        </a>
      </nav>

      <div className="sidebar-bottom">
        <a href="/settings" className="nav-item">
          <Settings size={18} />

          <span>Settings</span>
        </a>

        <div className="system-status">
          <span className="status-dot" />

          <div>
            <div className="status-title">
              System Operational
            </div>

            <div className="status-subtitle">
              All services healthy
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}