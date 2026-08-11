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

### 2. Capture Agent

The capture agent runs on the monitored machine.

```bash
cd capture-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python agent.py
```

Set any runtime values in `capture-agent/.env` before starting the agent.

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
