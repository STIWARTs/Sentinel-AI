# Demo & Testing Guide (Dataset Replay)

This document explains how to demonstrate and test the full Sentinel AI
detection pipeline **without a live capture agent**. The capture agent is
still under development, so `capture-agent/replay.py` acts as its stand-in:
it reads recorded flows from the CICIDS2017 dataset and posts them to the
backend exactly like the real agent will.

Everything below assumes the project root is `E:\GITHUB\Sentinel AI` and
PowerShell is used.

---

## What the replay demo proves

One replayed flow exercises the entire backend pipeline:

```
CSV row (recorded flow)
     |
replay.py  --POST-->  /api/ingest (X-Agent-Key auth)
                          |
                     ML prediction (model.pkl + scaler.pkl)
                          |
                     risk score + severity
                          |
                     flow_logs table (Postgres)
                          |
                     WebSocket broadcast (live dashboard feed)
                          |
                     correlation engine (attack chains, 15-min window)
                          |
                     if chain matched: Incident + MITRE mapping
                          |
                     Gemini explanation (if a valid key is set)
                          |
                     email / Telegram alert stubs
```

So a single command demonstrates prediction, storage, live push,
correlation, and incident creation end-to-end.

---

## Prerequisites (one-time setup)

### 1. Start PostgreSQL with a persistent volume

```powershell
docker compose up -d postgres
```

This uses the `postgres_data` named volume defined in `docker-compose.yml`,
so data survives `docker stop` / `docker start`. Only `docker compose down -v`
deletes the data. The password in the compose file (`sentinel123`) must match
`DATABASE_URL` in `backend/.env` — if they ever drift, every request that
writes to the DB fails with an authentication error.

### 2. Install backend dependencies

```powershell
cd backend
pip install -r requirements.txt
```

Note: `bcrypt` is pinned to 4.0.1 on purpose — passlib 1.7.4 crashes with
newer bcrypt versions. Do not "upgrade" it.

### 3. Seed the admin user

```powershell
cd backend
python seed_admin.py
```

Creates all tables (if missing) and inserts the admin user from
`SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` in `backend/.env`.
Re-running it is safe — it skips if the user exists.

### 4. Start the backend

```powershell
cd backend
uvicorn main:app --reload --port 8888
```

Port 8888 is used because Windows/Hyper-V reserves port ranges that include
8000 on many machines (`WinError 10013`). Check reserved ranges with:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

The frontend expects port 8000 by default, so put this in `frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:8888
```

### 5. Install replay dependencies

```powershell
cd capture-agent
pip install -r requirements.txt
```

And make sure `AGENT_INGEST_KEY` in `capture-agent/.env` is identical to the
one in `backend/.env` — otherwise `/api/ingest` returns 401.

---

## Running the demo

### Test 1 — normal traffic (Benign)

Monday's capture contains only benign traffic:

```powershell
cd capture-agent
python replay.py --rows 5 --delay 0.5
```

Expected output per flow:

```
true=BENIGN -> predicted=BENIGN (confidence=1.00, risk=0)
```

This proves the ingest endpoint, model loading, prediction, and DB storage
all work.

### Test 2 — single attack types

Friday afternoon contains PortScan; Friday morning contains Bot:

```powershell
python replay.py --csv "..\ml-pipeline\data\cicids2017\Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv" --rows 8 --mix
python replay.py --csv "..\ml-pipeline\data\cicids2017\Friday-WorkingHours-Morning.pcap_ISCX.csv" --rows 10 --mix
```

`--mix` samples roughly equal rows per class, otherwise the heavily
benign-skewed dataset would show almost no attacks in a short replay.
Expected: `predicted=PortScan` and `predicted=Bot` rows with non-zero risk
scores.

Tuesday adds BruteForce (SSH-Patator):

```powershell
python replay.py --csv "..\ml-pipeline\data\cicids2017\Tuesday-WorkingHours.pcap_ISCX.csv" --rows 10 --mix
```

### Test 3 — triggering a real incident (the highlight)

Incidents are only created when the correlation engine sees a **multi-stage
attack chain** from the same source IP within 15 minutes. The replay always
uses the same placeholder IP (`192.168.1.100`), so chaining works naturally.

Within 15 minutes of each other, run the PortScan replay (Test 2) and then
the BruteForce replay (Tuesday). When BruteForce arrives after PortScan, the
chain `["PortScan", "BruteForce"]` matches and an incident is created.

Verify in the database:

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, title, severity, attack_chain, mitre_technique FROM incidents;"
```

Expected row:

```
title: PortScan -> BruteForce from 192.168.1.100
attack_chain: PortScan -> BruteForce
mitre_technique: T1110
```

`ai_explanation` is only filled when `GEMINI_API_KEY` in `backend/.env`
contains a valid key (real Gemini keys start with `AIza`). The pipeline
never blocks on a missing or invalid key — the explanation simply stays empty.

### Test 4 — authentication and protected endpoints

```powershell
curl -X POST http://localhost:8888/api/auth/login -H "Content-Type: application/json" -d '{\"username\": \"admin\", \"password\": \"<your SEED_ADMIN_PASSWORD>\"}'
```

A successful login returns a JWT. Use it on protected endpoints:

```powershell
curl http://localhost:8888/api/incidents -H "Authorization: Bearer <token>"
```

Role enforcement: viewer < analyst < admin. The `/api/copilot/ask` endpoint
requires analyst or higher; incident status updates require analyst;
user-level management requires admin.

### Test 5 — interactive exploration

Open `http://localhost:8888/docs` for the Swagger UI — every endpoint is
documented there with example payloads. This is also the fastest way to show
the API surface during a viva.

---

## Replay flags reference

| Flag | Default | Meaning |
|---|---|---|
| `--csv` | Monday's file | Which CICIDS2017 CSV to replay |
| `--rows` | 20 | How many flows to send |
| `--delay` | 0.5 | Seconds between flows — use 0.5-1 during live demos so the dashboard feed visibly updates |
| `--mix` | off | Sample equal rows per class (benign + attacks) |
| `--url` | `http://localhost:8888/api/ingest` | Backend endpoint |
| `--agent-key` | from `capture-agent/.env` | X-Agent-Key header value |

Dataset quick reference (which file shows which attacks):

| CSV file | Attack classes inside |
|---|---|
| Monday-WorkingHours | BENIGN only |
| Tuesday-WorkingHours | FTP-Patator, SSH-Patator (BruteForce) |
| Wednesday-workingHours | DoS variants (mapped to DDoS by the 5-class model) |
| Thursday-WorkingHours-Morning-WebAttacks | Web attacks (Brute Force/XSS/SQLi — outside the 5-class set) |
| Friday-WorkingHours-Morning | Bot |
| Friday-WorkingHours-Afternoon-PortScan | PortScan |
| Friday-WorkingHours-Afternoon-DDos | DDoS |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 401 on `/api/ingest` | `AGENT_INGEST_KEY` differs between `capture-agent/.env` and `backend/.env` | Make both identical, restart backend |
| 500 on every ingest, logs show `password authentication failed` | Compose Postgres password does not match `DATABASE_URL` | Align `POSTGRES_PASSWORD` in `docker-compose.yml` with `backend/.env`, then `docker compose down -v` and `up -d postgres` (this wipes data — re-run `seed_admin.py` after) |
| `WinError 10013` when starting uvicorn | Port is inside a Hyper-V excluded range | Pick a port outside the ranges shown by `netsh interface ipv4 show excludedportrange protocol=tcp` (8888 works) |
| Whole backend freezes after restarting Postgres | Stale pooled DB connections | Fixed by `pool_pre_ping=True` in `database.py`; just restart uvicorn |
| Login returns 500 right after a pip downgrade | The running process still holds the old module in memory | Restart uvicorn (Ctrl+C and start again) |
| `InconsistentVersionWarning` at startup | Model was pickled with scikit-learn 1.6.1, runtime is newer | Warning only for now; proper fixes are retraining the notebook or pinning scikit-learn in a Python 3.12 venv |
| Empty `ai_explanation` on incidents | Missing/invalid `GEMINI_API_KEY` | Get a key from https://aistudio.google.com (starts with `AIza`), put it in `backend/.env`, restart |
| No incident created despite attack flows | Incidents need a full chain (e.g. PortScan then BruteForce) within 15 minutes from one IP | Replay the two attack CSVs back to back, or check `ATTACK_CHAINS` in `services/correlation_engine.py` |
| Correlation "forgets" previous attacks | Correlation state is in-memory by design | Restart-safe demo: replay both attack CSVs in one sitting; Redis persistence is future scope |

---

## Presentation-day checklist

1. Docker Desktop running, then `docker compose up -d postgres`.
2. Backend: `cd backend && uvicorn main:app --reload --port 8888`.
3. Frontend (teammate): `cd frontend && npm run dev`, with
   `VITE_API_BASE_URL=http://localhost:8888` in `frontend/.env`.
4. Warm up the pipeline: `python replay.py --rows 5 --delay 0` (benign).
5. During the demo: replay PortScan CSV, then Tuesday (BruteForce) with
   `--delay 1` — the dashboard live feed updates per flow, and the incident
   appears after the BruteForce flows land.
6. Open the incident detail page to show the attack chain and MITRE technique.
7. Keep `http://localhost:8888/docs` open as a backup to demo any endpoint
   interactively if something unexpected happens.
