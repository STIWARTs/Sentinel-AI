Here's the complete React dashboard — folder structure and all core components wired to the FastAPI backend and WebSocket you already built.

## Frontend folder structure

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── api/
│   │   └── client.js              # axios instance + API calls
│   ├── hooks/
│   │   └── useWebSocket.js         # live WS connection hook
│   ├── context/
│   │   └── AuthContext.jsx          # login state, JWT storage
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   └── Topbar.jsx
│   │   ├── dashboard/
│   │   │   ├── SummaryCards.jsx
│   │   │   ├── TrafficTimeline.jsx
│   │   │   ├── AttackDistributionChart.jsx
│   │   │   └── LiveFeed.jsx
│   │   ├── incidents/
│   │   │   ├── IncidentList.jsx
│   │   │   ├── IncidentDetail.jsx
│   │   │   └── IncidentBadge.jsx
│   │   └── copilot/
│   │       └── CopilotChat.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Incidents.jsx
│   │   ├── Reports.jsx
│   │   └── Login.jsx
│   └── styles/
│       └── index.css
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Step 1: Project setup

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install axios recharts react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

```javascript
// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        critical: "#dc2626",
        high: "#ea580c",
        medium: "#ca8a04",
        low: "#16a34a",
        bgdark: "#0b0f1a",
        panel: "#131826",
      }
    },
  },
  plugins: [],
}
```

```css
/* src/styles/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0b0f1a;
  color: #e5e7eb;
}
```

## Step 2: API client

```javascript
// src/api/client.js
import axios from "axios";

const client = axios.create({
  baseURL: "http://localhost:8000",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const login = (username, password) =>
  client.post("/api/auth/login", null, { params: { username, password } });

export const getSummary = () => client.get("/api/dashboard/summary");
export const getAttackDistribution = () => client.get("/api/dashboard/attack-distribution");
export const getIncidents = () => client.get("/api/incidents");
export const getIncident = (id) => client.get(`/api/incidents/${id}`);
export const updateIncidentStatus = (id, status) =>
  client.patch(`/api/incidents/${id}/status`, null, { params: { status } });
export const addIncidentAction = (id, action, performedBy) =>
  client.post(`/api/incidents/${id}/actions`, null, {
    params: { action, performed_by: performedBy },
  });

export default client;
```

## Step 3: WebSocket hook (live data)

```javascript
// src/hooks/useWebSocket.js
import { useEffect, useRef, useState } from "react";

export function useWebSocket(url) {
  const [lastMessage, setLastMessage] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        try {
          setLastMessage(JSON.parse(event.data));
        } catch {
          // ignore malformed message
        }
      };
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 2000); // auto-reconnect
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => wsRef.current?.close();
  }, [url]);

  return { lastMessage, connected };
}
```

## Step 4: Auth context

```jsx
// src/context/AuthContext.jsx
import { createContext, useContext, useState } from "react";
import { login as loginApi } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(localStorage.getItem("role"));
  const [token, setToken] = useState(localStorage.getItem("token"));

  const login = async (username, password) => {
    const res = await loginApi(username, password);
    localStorage.setItem("token", res.data.access_token);
    localStorage.setItem("role", res.data.role);
    setToken(res.data.access_token);
    setRole(res.data.role);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

## Step 5: Layout — Sidebar & Topbar

```jsx
// src/components/layout/Sidebar.jsx
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/incidents", label: "Incidents", icon: "🚨" },
  { to: "/reports", label: "Reports", icon: "📄" },
];

export default function Sidebar() {
  return (
    <div className="w-56 bg-panel h-screen border-r border-gray-800 p-4">
      <h1 className="text-xl font-bold text-white mb-8">🛡️ Sentinel AI</h1>
      <nav className="space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                isActive ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"
              }`
            }
          >
            <span>{link.icon}</span> {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

```jsx
// src/components/layout/Topbar.jsx
import { useAuth } from "../../context/AuthContext";

export default function Topbar({ connected }) {
  const { role, logout } = useAuth();

  return (
    <div className="h-16 bg-panel border-b border-gray-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-xs text-gray-400">
          {connected ? "Live monitoring active" : "Disconnected"}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400 capitalize">{role}</span>
        <button onClick={logout} className="text-sm text-red-400 hover:text-red-300">
          Logout
        </button>
      </div>
    </div>
  );
}
```

## Step 6: Summary Cards

```jsx
// src/components/dashboard/SummaryCards.jsx
export default function SummaryCards({ summary }) {
  const cards = [
    { label: "Today's Alerts", value: summary?.todays_alerts ?? 0, color: "text-blue-400" },
    { label: "Critical Threats", value: summary?.critical_threats ?? 0, color: "text-critical" },
    { label: "Resolved Incidents", value: summary?.blocked_attacks ?? 0, color: "text-low" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-panel rounded-xl p-5 border border-gray-800">
          <p className="text-gray-400 text-sm">{c.label}</p>
          <p className={`text-3xl font-bold mt-2 ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
```

## Step 7: Attack Distribution Chart

```jsx
// src/components/dashboard/AttackDistributionChart.jsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = { DDoS: "#dc2626", PortScan: "#ea580c", BruteForce: "#ca8a04", Bot: "#7c3aed" };

export default function AttackDistributionChart({ data }) {
  const chartData = Object.entries(data || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="bg-panel rounded-xl p-5 border border-gray-800 h-80">
      <p className="text-gray-300 font-medium mb-3">Attack Distribution</p>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} label>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] || "#64748b"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## Step 8: Live Traffic Feed (WebSocket-driven)

```jsx
// src/components/dashboard/LiveFeed.jsx
import { useEffect, useState } from "react";

export default function LiveFeed({ lastMessage }) {
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    if (lastMessage?.type === "flow_update") {
      setFeed((prev) => [lastMessage, ...prev].slice(0, 15));
    }
  }, [lastMessage]);

  return (
    <div className="bg-panel rounded-xl p-5 border border-gray-800 h-80 overflow-y-auto">
      <p className="text-gray-300 font-medium mb-3">Live Traffic Feed</p>
      <div className="space-y-2">
        {feed.length === 0 && <p className="text-gray-500 text-sm">Waiting for traffic...</p>}
        {feed.map((f, i) => (
          <div
            key={i}
            className={`flex justify-between text-xs px-3 py-2 rounded-lg ${
              f.prediction === "BENIGN" ? "bg-gray-800/50" : "bg-red-900/30 border border-red-800"
            }`}
          >
            <span className="text-gray-300">{f.src_ip}</span>
            <span
              className={f.prediction === "BENIGN" ? "text-gray-500" : "text-red-400 font-medium"}
            >
              {f.prediction}
            </span>
            <span className="text-gray-500">risk: {f.risk_score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Step 9: Incident Badge + List

```jsx
// src/components/incidents/IncidentBadge.jsx
const SEVERITY_STYLES = {
  Critical: "bg-red-900/40 text-red-400 border-red-800",
  High: "bg-orange-900/40 text-orange-400 border-orange-800",
  Medium: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  Low: "bg-green-900/40 text-green-400 border-green-800",
};

export default function IncidentBadge({ severity }) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  );
}
```

```jsx
// src/components/incidents/IncidentList.jsx
import { Link } from "react-router-dom";
import IncidentBadge from "./IncidentBadge";

export default function IncidentList({ incidents }) {
  return (
    <div className="bg-panel rounded-xl border border-gray-800 divide-y divide-gray-800">
      {incidents.map((inc) => (
        <Link
          to={`/incidents/${inc.id}`}
          key={inc.id}
          className="flex items-center justify-between p-4 hover:bg-gray-800/40 transition"
        >
          <div>
            <p className="text-gray-200 font-medium">{inc.title}</p>
            <p className="text-gray-500 text-xs mt-1">
              {inc.mitre_technique} · {new Date(inc.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Risk: {inc.risk_score}</span>
            <IncidentBadge severity={inc.severity} />
            <span className="text-xs text-gray-500">{inc.status}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

## Step 10: Incident Detail (with AI Copilot chat + actions)

```jsx
// src/pages/IncidentDetailPage.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getIncident, updateIncidentStatus, addIncidentAction } from "../api/client";
import IncidentBadge from "../components/incidents/IncidentBadge";
import CopilotChat from "../components/copilot/CopilotChat";

export default function IncidentDetailPage() {
  const { id } = useParams();
  const [incident, setIncident] = useState(null);
  const [actionText, setActionText] = useState("");

  const load = () => getIncident(id).then((res) => setIncident(res.data));

  useEffect(() => { load(); }, [id]);

  if (!incident) return <p className="text-gray-400">Loading...</p>;

  const handleStatusChange = async (status) => {
    await updateIncidentStatus(id, status);
    load();
  };

  const handleAddAction = async () => {
    if (!actionText.trim()) return;
    await addIncidentAction(id, actionText, "Analyst");
    setActionText("");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-panel rounded-xl p-6 border border-gray-800">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl text-white font-semibold">{incident.title}</h2>
            <p className="text-gray-500 text-sm mt-1">Source IP: {incident.src_ip}</p>
          </div>
          <IncidentBadge severity={incident.severity} />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
          <div><span className="text-gray-500">Attack Chain:</span> <p className="text-gray-300">{incident.attack_chain}</p></div>
          <div><span className="text-gray-500">MITRE Technique:</span> <p className="text-gray-300">{incident.mitre_technique}</p></div>
          <div><span className="text-gray-500">Risk Score:</span> <p className="text-gray-300">{incident.risk_score}/100</p></div>
        </div>

        {incident.ai_explanation && (
          <div className="mt-4 bg-blue-950/30 border border-blue-900 rounded-lg p-4">
            <p className="text-blue-300 text-xs font-medium mb-1">🤖 AI Copilot Explanation</p>
            <p className="text-gray-300 text-sm">{incident.ai_explanation}</p>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          {["Open", "In Progress", "Resolved"].map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border ${
                incident.status === s
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-700 text-gray-400 hover:bg-gray-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-panel rounded-xl p-6 border border-gray-800">
        <p className="text-gray-300 font-medium mb-3">Actions Taken</p>
        <div className="space-y-2 mb-3">
          {incident.actions?.map((a) => (
            <p key={a.id} className="text-sm text-gray-400">
              • {a.action} <span className="text-gray-600">by {a.performed_by}</span>
            </p>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            placeholder="e.g. Isolated host, reset credentials..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
          />
          <button onClick={handleAddAction} className="bg-blue-600 px-4 py-2 rounded-lg text-sm text-white">
            Log Action
          </button>
        </div>
      </div>

      <CopilotChat incidentContext={incident} />
    </div>
  );
}
```

## Step 11: Copilot Chat Component

```jsx
// src/components/copilot/CopilotChat.jsx
import { useState } from "react";
import client from "../../api/client";

export default function CopilotChat({ incidentContext }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const question = input;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await client.post("/api/copilot/ask", {
        question,
        context: incidentContext,
      });
      setMessages((prev) => [...prev, { role: "ai", text: res.data.answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Sorry, I couldn't process that." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-panel rounded-xl p-6 border border-gray-800">
      <p className="text-gray-300 font-medium mb-3">💬 Ask the AI Copilot</p>
      <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === "user" ? "text-blue-300" : "text-gray-300"}`}>
            <span className="font-medium">{m.role === "user" ? "You: " : "Copilot: "}</span>
            {m.text}
          </div>
        ))}
        {loading && <p className="text-gray-500 text-xs">Copilot is thinking...</p>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Why was this flagged? What should I do?"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
        />
        <button onClick={send} className="bg-blue-600 px-4 py-2 rounded-lg text-sm text-white">
          Ask
        </button>
      </div>
    </div>
  );
}
```

*(Corresponding backend endpoint you'd add: `POST /api/copilot/ask` in `routers/copilot.py`, calling `copilot_service.answer_question()`.)*

## Step 12: Dashboard page (assembles everything)

```jsx
// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { getSummary, getAttackDistribution } from "../api/client";
import { useWebSocket } from "../hooks/useWebSocket";
import SummaryCards from "../components/dashboard/SummaryCards";
import AttackDistributionChart from "../components/dashboard/AttackDistributionChart";
import LiveFeed from "../components/dashboard/LiveFeed";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const { lastMessage, connected } = useWebSocket("ws://localhost:8000/ws/live");

  useEffect(() => {
    getSummary().then((res) => setSummary(res.data));
    getAttackDistribution().then((res) => setDistribution(res.data));
  }, [lastMessage]); // refresh stats whenever new data arrives

  return (
    <div className="space-y-6">
      <SummaryCards summary={summary} />
      <div className="grid grid-cols-2 gap-4">
        <AttackDistributionChart data={distribution} />
        <LiveFeed lastMessage={lastMessage} />
      </div>
    </div>
  );
}
```

## Step 13: Incidents page

```jsx
// src/pages/Incidents.jsx
import { useEffect, useState } from "react";
import { getIncidents } from "../api/client";
import IncidentList from "../components/incidents/IncidentList";

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    getIncidents().then((res) => setIncidents(res.data));
  }, []);

  return (
    <div>
      <h2 className="text-xl text-white font-semibold mb-4">Incidents</h2>
      <IncidentList incidents={incidents} />
    </div>
  );
}
```

## Step 14: Login page

```jsx
// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-bgdark">
      <form onSubmit={handleSubmit} className="bg-panel p-8 rounded-xl border border-gray-800 w-80">
        <h1 className="text-xl text-white font-bold mb-6">🛡️ Sentinel AI Login</h1>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-3 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200"
        />
        <button className="w-full bg-blue-600 rounded-lg py-2 text-white font-medium">
          Log In
        </button>
      </form>
    </div>
  );
}
```

## Step 15: App.jsx — routing & layout assembly

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import IncidentDetailPage from "./pages/IncidentDetailPage";
import Login from "./pages/Login";
import { useWebSocket } from "./hooks/useWebSocket";

function ProtectedLayout({ children }) {
  const { token } = useAuth();
  const { connected } = useWebSocket("ws://localhost:8000/ws/live");

  if (!token) return <Navigate to="/login" />;

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <Topbar connected={connected} />
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/incidents" element={<ProtectedLayout><Incidents /></ProtectedLayout>} />
          <Route path="/incidents/:id" element={<ProtectedLayout><IncidentDetailPage /></ProtectedLayout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

```jsx
// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Run it

```bash
npm run dev
```

## How it all connects

```
Backend WebSocket (ws://localhost:8000/ws/live)
      ↓
useWebSocket hook → lastMessage updates
      ↓
Dashboard.jsx re-fetches summary/distribution on each new message
      ↓
LiveFeed.jsx shows real-time flow predictions as they stream in
      ↓
When correlation engine creates an incident → "new_incident" WS message
      ↓
(You can add a toast/notification listener for this — easy addition)
      ↓
Incidents.jsx / IncidentDetailPage.jsx → pull from REST API (/api/incidents)
      ↓
CopilotChat.jsx → POST /api/copilot/ask → Claude-generated answers
```

---

One thing missing from your backend that this dashboard expects: a `POST /api/copilot/ask` endpoint and a toast notification handler for `new_incident` WebSocket events. Want me to add those two pieces, or move to **Docker Compose** so the whole stack (frontend + backend + Postgres + Redis) runs with one command?