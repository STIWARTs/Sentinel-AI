import {
  LayoutDashboard,
  Network,
  ShieldAlert,
  FileText,
  Bot,
  Settings,
  Shield,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navigation = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/",
  },
  {
    label: "Incidents",
    icon: ShieldAlert,
    path: "/incidents",
  },
  {
    label: "Network",
    icon: Network,
    path: "/network",
  },
  {
    label: "AI Copilot",
    icon: Bot,
    path: "/copilot",
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

      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Shield size={17} strokeWidth={2.5} />
        </div>

        <div>
          <div className="brand-name">
            Sentinel AI
          </div>

          <div className="brand-subtitle">
            Intelligent Intrusion Detection
          </div>
        </div>
      </div>


      {/* Main Navigation */}
      <nav className="sidebar-nav">

        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={16} />

              <span>
                {item.label}
              </span>
            </NavLink>
          );
        })}

      </nav>


      {/* Bottom Navigation */}
      <div className="sidebar-bottom">

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <Settings size={16} />

          <span>
            Settings
          </span>
        </NavLink>

      </div>

    </aside>
  );
}