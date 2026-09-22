import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import IncidentDetailPage from "./pages/IncidentDetailPage";
import Reports from "./pages/Reports";
import Network from "./pages/Network";
import Copilot from "./pages/Copilot";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />

        <div className="app-main">
          <Topbar />

          <main className="page-container">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route
                path="/incidents/:id"
                element={<IncidentDetailPage />}
              />
              <Route path="/copilot" element={<Copilot />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/network" element={<Network />} />

              <Route
                path="*"
                element={<Navigate to="/" replace />}
              />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}