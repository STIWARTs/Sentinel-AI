import {
  Search,
  Bell,
  Sun,
} from "lucide-react";

export default function Topbar() {
  return (
    <header className="topbar">

      <div className="topbar-left">
        <div className="page-context">
          Security Overview
        </div>
      </div>

      <div className="topbar-right">

        <div className="search-box">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search..."
          />

          <span className="search-shortcut">
            /
          </span>
        </div>

        <button
          className="icon-button"
          aria-label="Toggle theme"
        >
          <Sun size={18} />
        </button>

        <button
          className="icon-button notification-button"
          aria-label="Notifications"
        >
          <Bell size={18} />

          <span className="notification-dot" />
        </button>

        <div className="user-menu">
          <div className="avatar">
            A
          </div>

          <div className="user-info">
            <div className="user-name">
              Admin
            </div>

            <div className="user-role">
              Administrator
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}