Threat intel APIs, MITRE mapping, and multi-channel alerts (SMS/Telegram) can be "planned/partially scaffolded" — mention them in the report as future scope, maybe stub one endpoint, without fully building them.


Here's the complete status check — everything covered in this conversation, organized by what's **done** vs **missing/gap**.

## ✅ What's Done (code written, working logic)

### ML Pipeline
- Data cleaning strategy (nulls, inf, duplicates)
- Feature selection list (~15-20 flow features)
- Class balancing approach (SMOTE)
- Model training plan (Random Forest/XGBoost)
- Evaluation approach (confusion matrix, F1, precision/recall)
- SHAP explainability plan
- Model saving (`joblib` → `model.pkl`, `scaler.pkl`)

### Capture Agent
- Scapy packet sniffing (`capture.py`)
- Rolling window aggregation by source IP (`aggregator.py`)
- Feature computation matching training features (`features.py`)
- Sender to backend API (`sender.py`)
- Main orchestration loop (`agent.py`)

### Backend
- FastAPI app structure, config, DB connection
- SQLAlchemy models: `FlowLog`, `Incident`, `IncidentAction`, `User`
- ML predictor loading + inference (`predictor.py`)
- Risk scoring logic (`risk_scoring.py`)
- MITRE ATT&CK mapping (`mitre_mapping.py`)
- Correlation engine — attack chain detection (`correlation_engine.py`)
- AI Copilot service using Claude API (`copilot_service.py`)
- WebSocket connection manager (`manager.py`)
- Ingest endpoint (full pipeline: predict → score → save → correlate → incident → explain → broadcast)
- Incidents CRUD endpoints
- Dashboard summary/stats endpoints
- JWT auth (login endpoint, token creation)
- **Alert service** — Email (SMTP) + Telegram notifications, wired into ingest flow

### Frontend
- Full React app structure with routing
- Auth context + login page
- WebSocket hook (live data)
- Dashboard page (summary cards, attack distribution chart, live feed)
- Incidents list + detail page (status updates, action logging)
- AI Copilot chat UI
- Sidebar/Topbar layout

---

## ❌ What's Missing / Referenced but NOT Built

| Item | Status |
|---|---|
| **`/api/copilot/ask` endpoint** | Frontend calls it, backend router file was never written |
| **Toast/popup notification on dashboard** for new incidents | Mentioned twice, never built |
| **Dataset replay script** (Option A fallback) | Only described, not coded — **you currently have ONLY live capture, no reliable backup demo path** |
| **Docker Compose file** | Referenced multiple times, never written |
| **Redis integration** | Only in-memory Python dict used for correlation engine; Redis was planned but not implemented |
| **Threat Intelligence Module** (VirusTotal/AbuseIPDB) | Mentioned in risk scoring (`is_known_malicious_ip` parameter exists) but no actual API integration written |
| **Reporting Module (PDF generation)** | `reportlab`/`WeasyPrint` mentioned in stack, no code written |
| **Role-based access control (RBAC) enforcement** | `User.role` field exists, JWT includes role, but no actual `Depends()` permission checks on endpoints (e.g., Viewer shouldn't be able to update incident status — not enforced anywhere) |
| **`auth/dependencies.py`** | Listed in folder structure, never written |
| **`schemas/` (Pydantic models)** | Listed in folder structure, never written — currently using raw `dict` in endpoints instead of validated schemas |
| **SMS alerts (Twilio)** | Mentioned as stack option, explicitly deferred to future scope |
| **Actual ML training notebook code** | We discussed the *steps*, but I never wrote the actual `train_model.ipynb` cell-by-cell code |
| **`seed_admin.py`** | Written, but never actually run/tested (you'll need to run it yourself) |
| **Reconnection/buffering logic in capture agent** | Mentioned as "edge case to handle," not implemented |
| **User registration endpoint** | Only login exists; no way to create new users via API (would need to insert directly into DB or extend `seed_admin.py`) |

---

## Priority order — what to build next (my recommendation)

1. **`/api/copilot/ask` endpoint** — frontend is already calling it, quick fix, unblocks the Copilot chat
2. **Dataset replay script** — your demo safety net, critical before presentation day
3. **Docker Compose** — makes everything runnable with one command, huge time-saver for setup/demo day
4. **`schemas/` Pydantic validation** — currently accepting raw dicts is a real bug risk (malformed data from agent could crash predictor)
5. **Toast notifications** — nice demo polish, relatively easy
6. **ML training notebook** — you need this regardless, to actually produce `model.pkl`
7. Everything else (Threat Intel APIs, PDF reports, RBAC enforcement, Redis) → mark as "Future Scope" in your report if time is tight

---

Want me to knock out #1–4 right now so your core demo path is actually complete and runnable end-to-end?