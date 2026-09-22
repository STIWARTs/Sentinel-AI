import { BrowserRouter, Routes, Route } from "react-router-dom";

import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import StatusBar from "./components/layout/StatusBar";
import Network from "./pages/Network";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import IncidentDetailPage from "./pages/IncidentDetailPage";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import Copilot from "./pages/Copilot";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<Login />} />

        <Route
          path="*"
          element={
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
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/network" element={<Network />} />
                    <Route path="/copilot" element={<Copilot />} />
                  </Routes>
                </main>

                <StatusBar />
              </div>
            </div>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;