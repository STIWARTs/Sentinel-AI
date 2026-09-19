# Sentinel AI

Scaffold for a network intrusion detection and response platform.

## Project Layout

- `ml-pipeline/` - offline model training and artifact generation
- `capture-agent/` - live packet capture and feature extraction on monitored machines
- `backend/` - FastAPI service for ingestion, alerts, and dashboard APIs
- `frontend/` - React dashboard for incidents and live telemetry

## How to Run

This repository is scaffolded into separate services, so you can run each part independently or bring the stack up with Docker.

### 1. ML Pipeline

Use the ML pipeline to train the model and generate artifacts.

```bash
cd ml-pipeline
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
jupyter notebook notebooks/train_model.ipynb
```

Place the CICIDS2017 CSV files in `ml-pipeline/data/cicids2017/`, then save the trained artifacts to `ml-pipeline/output/`.

### 2. Capture Agent & Pipeline Modes

The capture agent runs on the monitored machine. It supports two modes: **Real Live Traffic Capture** and **Dataset Replay Demo**.

#### Prerequisites:
```bash
cd capture-agent
pip install -r requirements.txt
# Set AGENT_INGEST_KEY in capture-agent/.env matching backend/.env
```

#### Mode A: Real Live Capture Pipeline (`agent.py`)
Captures real live network traffic from your Wi-Fi or Ethernet adapter, aggregates flows, computes features, and sends them to the backend:

```bash
# List available network adapters on your machine
python agent.py --list-interfaces

# Dry-run mode (sniff and compute features locally without sending)
python agent.py --iface "Wi-Fi" --bpf "ip and not port 8888" --dry-run

# Real live mode (streams live detections to backend & UI)
python agent.py --iface "Wi-Fi" --bpf "ip and not port 8888"

# Replay a PCAP recording file
python agent.py --pcap test.pcap
```
*Note: Live capture on Windows requires Npcap installed with WinPcap API-compatible mode, and the terminal must be run as Administrator.*

#### Mode B: Dataset Replay Demo Fallback (`replay.py`)
Reads recorded flow rows directly from the CICIDS2017 dataset CSVs and posts them to the backend (ideal for offline presentations and attack-chain testing):

```bash
# Replay 20 mixed flows (benign + attack samples)
python replay.py --rows 20 --delay 0.5 --mix

# Replay PortScan attack dataset
python replay.py --csv "..\ml-pipeline\data\cicids2017\Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv" --rows 8 --mix

# Replay BruteForce attack dataset (Tuesday)
python replay.py --csv "..\ml-pipeline\data\cicids2017\Tuesday-WorkingHours.pcap_ISCX.csv" --rows 10 --mix
```

### 3. Backend

The backend is a FastAPI app.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Set environment values in `backend/.env` before running the server.

### 4. Frontend

The dashboard is a Vite React app.

```bash
cd frontend
npm install
npm run dev
```

If needed, set `VITE_API_BASE_URL` to point to the backend.

### 5. Full Stack with Docker

If you want the backend, frontend, PostgreSQL, and Redis containers together:

```bash
docker compose up --build
```

The default ports in the scaffold are:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
