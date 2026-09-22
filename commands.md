# Sentinel AI Commands

Run the services in separate PowerShell terminals.

## 1. Start PostgreSQL

From the repository root:

```powershell
cd "E:\GITHUB\Sentinel AI"
docker compose up -d postgres
```

## 2. Start the Backend

```powershell
cd "E:\GITHUB\Sentinel AI\backend"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8888
```

Backend URL: `http://localhost:8888`

## 3. Start the Frontend

```powershell
cd "E:\GITHUB\Sentinel AI\frontend"
npm run dev
```

Dashboard URL: `http://localhost:5173`

## 4. Run the Normal Live Capture Agent

Open PowerShell as Administrator. Npcap must be installed with WinPcap-compatible mode enabled.

```powershell
cd "E:\GITHUB\Sentinel AI\capture-agent"
.\.venv\Scripts\python.exe agent.py --bpf "ip and not port 8888"
```

Use demo pacing to make dashboard updates easier to see:

```powershell
.\.venv\Scripts\python.exe agent.py --bpf "ip and not port 8888" --send-delay 0.2
```

List interfaces:

```powershell
.\.venv\Scripts\python.exe agent.py --list-interfaces
```

Specify an interface explicitly:

```powershell
.\.venv\Scripts\python.exe agent.py --iface "Wi-Fi" --bpf "ip and not port 8888"
```

Stop live capture with `Ctrl+C`.

## 5. Trigger an Attack Replay

Run the replay commands from `capture-agent` using its virtual environment.
Use the same `--src-ip` for both stages so the correlation engine detects one attack chain.

### PortScan Stage

```powershell
cd "E:\GITHUB\Sentinel AI\capture-agent"
.\.venv\Scripts\python.exe replay.py --csv "..\ml-pipeline\data\cicids2017\Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv" --rows 12 --delay 0.5 --mix --src-ip 192.168.1.101
```

### BruteForce Stage

```powershell
.\.venv\Scripts\python.exe replay.py --csv "..\ml-pipeline\data\cicids2017\Tuesday-WorkingHours.pcap_ISCX.csv" --rows 20 --delay 0.5 --mix --src-ip 192.168.1.101
```

This can create a `PortScan -> BruteForce` incident, generate a Gemini explanation, and trigger email and Telegram notifications when the credentials in `backend/.env` are valid.

## 6. Optional Benign Replay

```powershell
cd "E:\GITHUB\Sentinel AI\capture-agent"
.\.venv\Scripts\python.exe replay.py --rows 20 --delay 0.5 --mix
```

## 7. Check Backend Data

Dashboard summary:

```powershell
Invoke-RestMethod http://localhost:8888/api/dashboard/summary
```

Recent flows:

```powershell
Invoke-RestMethod http://localhost:8888/api/dashboard/recent-flows
```

Incidents:

```powershell
Invoke-RestMethod http://localhost:8888/api/incidents
```

Health check:

```powershell
Invoke-RestMethod http://localhost:8888/
```

## Notes

- Keep `AGENT_INGEST_KEY` identical in `backend/.env` and `capture-agent/.env`.
- The backend uses port `8888` for local Windows development.
- Keep `DISABLE_AUTH=true` and `VITE_DISABLE_AUTH=true` only for local development.
- Never commit `.env` files or real credentials.
- Rotate any credentials that have been exposed outside the local environment.
