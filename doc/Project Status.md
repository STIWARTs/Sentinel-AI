# Project Status

**Last updated:** 13-08-2026, 20:41 (IST)

Snapshot of where Sentinel AI stands, what has been verified working, the
setup knowledge collected while getting there, and what remains. Update this
document whenever a major milestone or environment change happens.

For the step-by-step demo walkthrough see `doc/Demo and Testing Guide.md`.

---

## 1. Current state (verified end-to-end)

The complete detection pipeline works live, tested with real data on
Postgres via Docker:

| Pipeline stage | Status | Evidence |
|---|---|---|
| Ingest endpoint + X-Agent-Key auth | Working | replay POSTs accepted |
| ML prediction (XGBoost + StandardScaler) | Working | PortScan 0.96, BruteForce 1.00, BENIGN 1.00 confidence |
| Risk scoring + severity | Working | risk 54 -> Medium |
| PostgreSQL persistence | Working | flow_logs and incidents rows written |
| Correlation engine (15-min rolling window) | Working | PortScan -> BruteForce chain detected |
| MITRE ATT&CK mapping | Working | T1110 attached to incident |
| Gemini AI Copilot (incident explanation) | Working | full plain-English explanation with next steps stored in ai_explanation |
| Copilot Q&A endpoint (/api/copilot/ask) | Working | 200 with real Gemini answer, analyst role enforced |
| JWT login + role-based access control | Working | admin login, viewer < analyst < admin hierarchy |
| WebSocket live broadcast | Wired | broadcast calls in ingest flow; frontend consumer not built yet |

The live capture agent (`capture-agent/agent.py`) is now implemented and is
the real ingestion path: scapy sniffing -> bidirectional 5-tuple flow
aggregation -> the same 20 CICIDS2017 features -> POST /api/ingest.

`capture-agent/replay.py` stays as the demo fallback for presentation day and
for machines without a packet-capture driver.

## 2. Component ownership and completion

| Component | Owner | Status |
|---|---|---|
| ML pipeline / model training (Step 1) | Stiwart | Done. Artifacts in backend/ml/ |
| Backend, full Step 3 (Step 3 part I + II) | Stiwart | Done and verified live |
| Dataset replay demo fallback | Stiwart | Done. capture-agent/replay.py |
| Capture agent (Step 2) | teammate | Done. Live sniffing, flow aggregation, feature computation and sender implemented; see capture-agent/README.md |
| Frontend dashboard (Step 4) | teammate | NOT started. React skeleton exists in frontend/ |
| Docker Compose | Stiwart | Postgres service usable; backend/frontend services reference Dockerfiles that do not exist yet |

## 3. Environment knowledge (hard-won, do not lose)

### Ports
- Backend runs on **8888**, not 8000. Windows/Hyper-V reserves port ranges
  that include 8000 on this machine (WinError 10013). Check with
  `netsh interface ipv4 show excludedportrange protocol=tcp`.
- Frontend must set `VITE_API_BASE_URL=http://localhost:8888` in
  `frontend/.env` because api/client.js defaults to port 8000.

### Database
- Postgres runs via `docker compose up -d postgres` with the named volume
  `postgres_data`, so data survives container restarts.
  `docker compose down -v` deletes the data.
- `POSTGRES_PASSWORD` in docker-compose.yml MUST match `DATABASE_URL` in
  backend/.env (currently sentinel123). A mismatch causes a 500 on every
  write with no obvious error in the HTTP response.
- Tables are created automatically at backend startup
  (`Base.metadata.create_all`). After wiping the volume, restart the backend
  and re-run `python seed_admin.py`.
- `pool_pre_ping=True` on the engine prevents the whole server from hanging
  when Postgres restarts while the backend keeps running.

### Secrets and environment variables
- All secrets live in backend/.env (git-ignored). Never commit them.
- pydantic-settings gives OS-level environment variables PRIORITY over .env.
  A stale user variable silently overrides the file. This actually happened
  with GEMINI_API_KEY: an old key from a previous project disabled the
  copilot for hours.
- Long-running programs (IDE, Windows Terminal) keep the environment
  they started with. Terminals opened inside them inherit that stale
  environment even after the registry value is removed. Fix for a session:
  `Remove-Item Env:GEMINI_API_KEY` before starting uvicorn, or fully restart
  the IDE.
- AGENT_INGEST_KEY must be identical in backend/.env and capture-agent/.env.

### Gemini Copilot
- Model: `gemini-2.5-flash` — confirmed to work on the free tier. Older
  names (gemini-2.5-flash-lite, gemini-2.0-flash) now return 404.
- Current API keys use the new `AQ.` prefix format.
- Without a valid key the pipeline degrades gracefully: incidents are still
  created, ai_explanation simply stays empty.

### Python dependencies
- Python 3.14 runtime.
- `bcrypt` is pinned to 4.0.1 in backend/requirements.txt — passlib 1.7.4
  crashes with bcrypt >= 4.1. Do not upgrade it.
- After any pip install/downgrade, restart uvicorn: a running process keeps
  the old module version in memory.
- scikit-learn is NOT pinned: runtime 1.9.0 vs model pickled with 1.6.1
  raises InconsistentVersionWarning. Predictions verified correct so far;
  proper fix is retraining or a pinned Python 3.12 venv (open item).
- On Windows, run pip while uvicorn is stopped, otherwise uvicorn.exe is
  file-locked and the install fails (WinError 32).

### Git workflow
- Work happens on feature branches (backend, capture-agent/demo) merged into
  main. During merges, conflicting shared files (database.py,
  requirements.txt, docker-compose.yml) must keep the BRANCH version —
  a merge that kept main's old versions once broke the entire backend.

## 4. Feature sync state (AGENTS.md golden rule)

All three copies of the feature set are in sync — verified file-by-file:
1. ml-pipeline/notebooks/output/feature_list.json
2. capture-agent/feature_list.json
3. backend/ml/feature_list.json (and predictor.py)

20 features, identical names and order. label_mapping.json identical too
(0 BENIGN, 1 Bot, 2 BruteForce, 3 DDoS, 4 PortScan).

FEATURE_NAME_MAP in backend/ml/predictor.py translates snake_case agent keys
to CICIDS2017 names. The live agent now exercises it: capture-agent posts
snake_case keys, and capture-agent/features.py holds AGENT_TO_MODEL, the
agent-side copy of the same dict.

Three guards keep this from drifting again:
- agent.py calls verify_feature_sync() before capturing a single packet and
  refuses to start if AGENT_TO_MODEL no longer matches feature_list.json;
- capture-agent/test_agent.py asserts AGENT_TO_MODEL equals FEATURE_NAME_MAP
  (read out of predictor.py with ast, so no ML imports are needed) and that
  all three feature_list.json copies are identical;
- sender.py validates every payload before it leaves the agent.

replay.py bypasses the map by sending CICIDS names directly (the predictor
passes unknown-looking keys through unchanged).

## 5. Open items

### Blocking the full demo
1. Frontend implementation (teammate) — dashboard, incidents, copilot chat,
   WebSocket consumption. Needs VITE_API_BASE_URL=http://localhost:8888.
2. Integration test of agent -> backend -> dashboard once the frontend exists.
3. Npcap must be installed (with "WinPcap API-compatible mode") before the
   agent can capture live on Windows, and the terminal must run as
   Administrator. Without it the agent still works via `--pcap`, which
   replays a capture file through the identical code path.

### Should do before submission
4. Resolve scikit-learn version mismatch (retrain model with runtime
   version, or pin scikit-learn==1.6.1 in a Python 3.12 venv).
5. Dockerfiles for backend and frontend so `docker compose up` works fully.
6. Replace placeholder values in backend/.env before any shared demo
   (JWT_SECRET and AGENT_INGEST_KEY are still the example strings).

### Explicitly deferred (report as Future Scope)
- Threat intelligence API integration (is_known_malicious_ip is a stub)
- Redis persistence for the correlation engine (in-memory by design)
- Email / Telegram alert delivery (stubs wired into the pipeline)
- PDF report generation (frontend Reports.jsx exists, no backend generator)
- User registration endpoint (login-only by design; users seeded manually)
- SHAP values at inference time (used only in the training notebook)
- Capture agent local buffering when the backend is unreachable (it retries
  with backoff and then drops the flow; nothing is spooled to disk)

## 6. Quick reference

```powershell
# Database
docker compose up -d postgres
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai

# Backend (from backend/)
uvicorn main:app --reload --port 8888
python seed_admin.py

# Live capture agent (from capture-agent/, Administrator terminal)
python test_agent.py                          # offline self-test, no setup needed
python agent.py --list-interfaces
python agent.py --iface "Wi-Fi"
python agent.py --iface "Wi-Fi" --dry-run     # compute and log, send nothing
python agent.py --pcap ..\captures\scan.pcap  # replay a capture file

# Demo replay (from capture-agent/)
python replay.py --rows 20 --delay 0.5 --mix

cd ..\capture-agent
python replay.py --csv "..\ml-pipeline\data\cicids2017\Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv" --rows 6 --mix
python replay.py --csv "..\ml-pipeline\data\cicids2017\Tuesday-WorkingHours.pcap_ISCX.csv" --rows 10 --mix

# Verify a chain creates an incident
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, title, severity, mitre_technique FROM incidents;"
```
