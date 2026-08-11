Here's the **complete, consolidated project structure and flow** — everything from earlier, combined into one unified view.

## Full Project Folder Structure

```
sentinel-ai/
│
├── ml-pipeline/                        # Model training (offline, run once)
│   ├── notebooks/
│   │   └── train_model.ipynb
│   ├── data/
│   │   └── cicids2017/                 # raw CSVs (not committed to git)
│   ├── output/
│   │   ├── model.pkl
│   │   ├── scaler.pkl
│   │   └── feature_list.json
│   └── requirements.txt
│
├── capture-agent/                      # Live packet sniffer (runs on monitored machine)
│   ├── agent.py                        # main entry point
│   ├── capture.py                      # Scapy sniffing logic
│   ├── aggregator.py                   # groups packets into time windows
│   ├── features.py                     # computes flow features (matches ML pipeline)
│   ├── sender.py                       # POSTs features to backend
│   ├── feature_list.json               # shared schema (synced from ml-pipeline)
│   ├── .env
│   └── requirements.txt
│
├── backend/                            # FastAPI application
│   ├── main.py                         # app entry point, router registration
│   ├── config.py                       # env settings
│   ├── database.py                     # DB engine/session
│   ├── seed_admin.py                   # creates first admin user
│   ├── .env
│   ├── models/                         # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── flow_log.py
│   │   ├── incident.py
│   │   └── user.py
│   ├── schemas/                        # Pydantic request/response models
│   │   ├── flow_schema.py
│   │   ├── incident_schema.py
│   │   └── auth_schema.py
│   ├── ml/                             # copied from ml-pipeline/output
│   │   ├── model.pkl
│   │   ├── scaler.pkl
│   │   ├── feature_list.json
│   │   └── predictor.py
│   ├── services/
│   │   ├── correlation_engine.py
│   │   ├── risk_scoring.py
│   │   ├── mitre_mapping.py
│   │   ├── alert_service.py            # email/telegram
│   │   └── copilot_service.py          # Claude API
│   ├── routers/
│   │   ├── ingest.py
│   │   ├── incidents.py
│   │   ├── dashboard.py
│   │   ├── auth.py
│   │   └── copilot.py
│   ├── websocket/
│   │   └── manager.py
│   ├── auth/
│   │   ├── jwt_handler.py
│   │   └── dependencies.py
│   └── requirements.txt
│
├── frontend/                           # React dashboard
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js
│       ├── hooks/
│       │   └── useWebSocket.js
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx
│       │   │   └── Topbar.jsx
│       │   ├── dashboard/
│       │   │   ├── SummaryCards.jsx
│       │   │   ├── AttackDistributionChart.jsx
│       │   │   └── LiveFeed.jsx
│       │   ├── incidents/
│       │   │   ├── IncidentList.jsx
│       │   │   ├── IncidentBadge.jsx
│       │   │   └── IncidentDetail.jsx
│       │   └── copilot/
│       │       └── CopilotChat.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Incidents.jsx
│       │   ├── IncidentDetailPage.jsx
│       │   ├── Reports.jsx
│       │   └── Login.jsx
│       └── styles/
│           └── index.css
│
├── docker-compose.yml                  # runs postgres + redis + backend + frontend together
├── .gitignore
└── README.md
```

## Complete System Flow (end to end)

```
┌──────────────────────────────────────────────────────────────────┐
│  PHASE 1 — OFFLINE MODEL TRAINING (done once, in ml-pipeline/)      │
└──────────────────────────────────────────────────────────────────┘

CICIDS2017 CSVs
      │
      ▼
Clean data (pandas) → drop nulls/inf, remove duplicates
      │
      ▼
Feature selection (~15-20 features) + label consolidation
      │
      ▼
Balance classes (SMOTE) → handle BENIGN-heavy imbalance
      │
      ▼
Train/test split + scale (StandardScaler)
      │
      ▼
Train model (Random Forest / XGBoost)
      │
      ▼
Evaluate (confusion matrix, F1, precision/recall)
      │
      ▼
SHAP explainability (feeds AI Copilot later)
      │
      ▼
Save → model.pkl, scaler.pkl, feature_list.json
      │
      ▼
Copy these 3 files into backend/ml/


┌──────────────────────────────────────────────────────────────────┐
│  PHASE 2 — LIVE SYSTEM (runs continuously, this is the actual app) │
└──────────────────────────────────────────────────────────────────┘

  [capture-agent/]                    [backend/]                    [frontend/]
  running on monitored              FastAPI server                React dashboard
  machine/network                   (port 8000)                   (port 5173)

Scapy sniffs live packets
      │
      ▼
Queue packets (capture.py)
      │
      ▼
Every 3 sec: group by src_ip
(aggregator.py)
      │
      ▼
Compute flow features
(features.py — packets/sec,
unique ports, SYN count, etc.)
      │
      ▼
POST /api/ingest ─────────────────►  Receive features
(sender.py)                                │
                                            ▼
                                   Load model.pkl + scaler.pkl
                                   (predictor.py)
                                            │
                                            ▼
                                   Predict: BENIGN / DDoS /
                                   PortScan / BruteForce / Bot
                                   + confidence score
                                            │
                                            ▼
                                   calculate_risk_score()
                                   (risk_scoring.py)
                                            │
                                            ▼
                                   Save row → FlowLog table
                                   (PostgreSQL)
                                            │
                                            ▼
                                   Broadcast "flow_update" ──────►  useWebSocket hook
                                   via WebSocket                   receives lastMessage
                                            │                              │
                                            ▼                              ▼
                                   If NOT benign:                 LiveFeed.jsx shows
                                   record_event() in               real-time traffic
                                   correlation_engine.py
                                   (tracks per-IP attack
                                   sequence in rolling window)
                                            │
                                            ▼
                                   Chain matched? (e.g.
                                   PortScan → BruteForce)
                                            │
                                    ┌───────┴───────┐
                                   YES              NO
                                    │                │
                                    ▼                └─► loop continues,
                          Create Incident in DB           waiting for next flow
                          (mitre_mapping.py attaches
                          MITRE technique)
                                    │
                                    ▼
                          generate_explanation()
                          via Claude API
                          (copilot_service.py)
                                    │
                                    ▼
                          Save AI explanation
                          to Incident row
                                    │
                                    ▼
                          Broadcast "new_incident" ────────►  Toast/alert appears
                          via WebSocket                       on dashboard
                                    │
                                    ▼
                          alert_service.py sends
                          Email/Telegram notification
                                    │
                                    ▼
                          Analyst opens incident ◄──────────  Incidents.jsx →
                          via REST API                        IncidentDetailPage.jsx
                                    │
                                    ▼
                          Analyst chats with Copilot ◄───────  CopilotChat.jsx
                          POST /api/copilot/ask                POST question + context
                                    │
                                    ▼
                          Analyst logs action,
                          updates status
                          (Open → In Progress → Resolved)
                                    │
                                    ▼
                          Reporting module generates
                          PDF summary (reportlab)
```

## Data storage summary (what lives where)

| Store | What it holds |
|---|---|
| **PostgreSQL** | `flow_logs` (every prediction), `incidents` (correlated attack chains), `incident_actions`, `users` |
| **Redis** *(optional upgrade)* | Correlation engine's per-IP event history (currently in-memory dict — swap to Redis if you want persistence across restarts) |
| **Local files** (`backend/ml/`) | `model.pkl`, `scaler.pkl`, `feature_list.json` — loaded once at backend startup |

## Startup order (how you'd run this for a demo)

```bash
# 1. Start database
docker run --name sentinel-postgres -e POSTGRES_USER=sentinel \
  -e POSTGRES_PASSWORD=sentinel123 -e POSTGRES_DB=sentinel_ai \
  -p 5432:5432 -d postgres:16

# 2. Seed admin user (one-time)
cd backend && python seed_admin.py

# 3. Start backend
uvicorn main:app --reload --port 8000

# 4. Start frontend
cd frontend && npm run dev

# 5. Start capture agent (needs admin/sudo)
cd capture-agent && sudo python3 agent.py

# 6. Open browser → http://localhost:5173 → login → watch live dashboard
# 7. In another terminal, generate test traffic:
nmap -sS 127.0.0.1          # simulates port scan
hping3 -S --flood -p 80 <test-ip>   # simulates DDoS (own test machine only)
```

---

This is the complete picture — training pipeline, capture agent, backend, and frontend all connected. Want me to write the **Docker Compose file** next so steps 1, 3, and 4 all run with a single `docker-compose up` command, or start on the **project report/synopsis document** (Word doc) summarizing all of this for submission?