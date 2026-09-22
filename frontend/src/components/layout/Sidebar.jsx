import {
  LayoutDashboard,
  Network,
  ShieldAlert,
  FileText,
  Bot,
  Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";

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

      {/* Brand */}
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


      {/* Main Navigation */}
      <nav className="sidebar-nav">

        <div className="nav-section-title">
          MONITOR
        </div>

        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />

              <span>
                {item.label}
              </span>
            </NavLink>
          );
        })}


        {/* AI Assistance */}
        <div className="nav-section-title">
          ASSIST
        </div>

        <NavLink
          to="/copilot"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <Bot size={18} />

          <span>
            AI Copilot
          </span>
        </NavLink>

      </nav>


      {/* Bottom Navigation */}
      <div className="sidebar-bottom">

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <Settings size={18} />

          <span>
            Settings
          </span>
        </NavLink>

      </div>

    </aside>
  );
}