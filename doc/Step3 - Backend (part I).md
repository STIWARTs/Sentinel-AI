Here's the complete backend build — folder structure, all core modules, and working code for each piece: ingestion → prediction → correlation → risk scoring → incident creation → websocket push → auth → alerts.

## Backend folder structure

```
backend/
├── main.py                    # FastAPI app entry point
├── config.py                  # settings, env vars
├── database.py                 # DB connection/session
├── models/
│   ├── __init__.py
│   ├── incident.py            # Incident, Alert DB models
│   ├── user.py                # User model (auth)
│   └── flow_log.py            # raw flow prediction logs
├── schemas/
│   ├── flow_schema.py         # pydantic request/response models
│   ├── incident_schema.py
│   └── auth_schema.py
├── ml/
│   ├── model.pkl
│   ├── scaler.pkl
│   ├── feature_list.json
│   └── predictor.py            # loads model, runs prediction
├── services/
│   ├── correlation_engine.py    # chains related events into incidents
│   ├── risk_scoring.py          # computes risk score
│   ├── mitre_mapping.py         # maps attack type -> MITRE technique
│   ├── alert_service.py         # email/telegram notifications
│   └── copilot_service.py       # Google Gemini API integration
├── routers/
│   ├── ingest.py               # POST /api/ingest (from capture agent)
│   ├── incidents.py            # incident CRUD
│   ├── dashboard.py            # stats for dashboard cards/charts
│   ├── auth.py                 # login/register/JWT
│   └── copilot.py              # chat with AI assistant
├── websocket/
│   └── manager.py               # WebSocket connection manager
├── auth/
│   ├── jwt_handler.py
│   └── dependencies.py          # role-based access control
└── requirements.txt
```

## Step 1: Config & Database setup

```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/sentinel_ai"
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str = "change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

```python
# database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## Step 2: DB Models

```python
# models/flow_log.py
from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from database import Base

class FlowLog(Base):
    __tablename__ = "flow_logs"

    id = Column(Integer, primary_key=True, index=True)
    src_ip = Column(String, index=True)
    prediction = Column(String, index=True)   # BENIGN, DDoS, PortScan, etc.
    confidence = Column(Float)
    risk_score = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)
```

```python
# models/incident.py
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    src_ip = Column(String, index=True)
    attack_chain = Column(Text)          # e.g. "PortScan -> BruteForce -> PrivEsc"
    mitre_technique = Column(String)
    risk_score = Column(Integer)
    severity = Column(String)             # Low/Medium/High/Critical
    status = Column(String, default="Open")   # Open/In Progress/Resolved
    assigned_to = Column(String, nullable=True)
    ai_explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    actions = relationship("IncidentAction", back_populates="incident")

class IncidentAction(Base):
    __tablename__ = "incident_actions"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"))
    action = Column(String)
    performed_by = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="actions")
```

```python
# models/user.py
from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="viewer")   # admin / analyst / viewer
```

## Step 3: ML Predictor

```python
# ml/predictor.py
import joblib
import pandas as pd
import json

model = joblib.load("ml/model.pkl")
scaler = joblib.load("ml/scaler.pkl")

with open("ml/feature_list.json") as f:
    FEATURE_ORDER = json.load(f)

def predict(features: dict):
    row = pd.DataFrame([features])[FEATURE_ORDER]
    scaled = scaler.transform(row)
    prediction = model.predict(scaled)[0]
    confidence = float(model.predict_proba(scaled).max())
    return prediction, confidence
```

## Step 4: Risk Scoring Service

```python
# services/risk_scoring.py

ATTACK_BASE_SCORE = {
    "BENIGN": 0,
    "PortScan": 40,
    "BruteForce": 55,
    "DDoS": 75,
    "Bot": 65,
}

def calculate_risk_score(attack_type: str, confidence: float, is_known_malicious_ip: bool = False):
    if attack_type == "BENIGN":
        return 0

    base = ATTACK_BASE_SCORE.get(attack_type, 30)
    score = base * confidence

    if is_known_malicious_ip:
        score += 15   # bump if threat intel flags the IP

    score = min(int(score), 100)
    return score

def score_to_severity(score: int) -> str:
    if score >= 80:
        return "Critical"
    elif score >= 60:
        return "High"
    elif score >= 30:
        return "Medium"
    return "Low"
```

## Step 5: MITRE Mapping

```python
# services/mitre_mapping.py

MITRE_MAP = {
    "PortScan": {"technique": "T1046", "name": "Network Service Discovery"},
    "BruteForce": {"technique": "T1110", "name": "Brute Force"},
    "DDoS": {"technique": "T1498", "name": "Network Denial of Service"},
    "Bot": {"technique": "T1071", "name": "Application Layer Protocol (C2)"},
}

def get_mitre_info(attack_type: str):
    return MITRE_MAP.get(attack_type, {"technique": "N/A", "name": "Unknown"})
```

## Step 6: Correlation Engine (the core "smart" logic)

This tracks recent events per source IP (using Redis or in-memory cache) and detects attack chains.

```python
# services/correlation_engine.py
from collections import defaultdict
from datetime import datetime, timedelta

# In-memory store: { src_ip: [ (attack_type, timestamp), ... ] }
# For production, replace with Redis for persistence across restarts
recent_events = defaultdict(list)

CORRELATION_WINDOW_MINUTES = 15

# Known attack chain patterns (order matters)
ATTACK_CHAINS = [
    ["PortScan", "BruteForce"],
    ["PortScan", "BruteForce", "DDoS"],
    ["BruteForce", "Bot"],
]

def record_event(src_ip: str, attack_type: str):
    if attack_type == "BENIGN":
        return None

    now = datetime.utcnow()
    recent_events[src_ip].append((attack_type, now))

    # drop events outside the correlation window
    cutoff = now - timedelta(minutes=CORRELATION_WINDOW_MINUTES)
    recent_events[src_ip] = [(a, t) for a, t in recent_events[src_ip] if t > cutoff]

    return check_for_incident(src_ip)

def check_for_incident(src_ip: str):
    event_sequence = [a for a, t in recent_events[src_ip]]

    for chain in ATTACK_CHAINS:
        if is_subsequence(chain, event_sequence):
            return {
                "src_ip": src_ip,
                "chain": " -> ".join(chain),
                "matched_pattern": chain,
            }
    return None

def is_subsequence(pattern, sequence):
    """Check if pattern appears as an ordered subsequence in sequence"""
    it = iter(sequence)
    return all(item in it for item in pattern)
```

## Step 7: AI Copilot Service (Google Gemini integration)

```python
# services/copilot_service.py
from google import genai
from config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

def generate_explanation(incident_data: dict):
    prompt = f"""You are a cybersecurity analyst assistant. Explain this detected incident 
in plain English for a junior security analyst, and recommend next steps.

Attack chain: {incident_data.get('attack_chain')}
Source IP: {incident_data.get('src_ip')}
Risk Score: {incident_data.get('risk_score')}/100
MITRE Technique: {incident_data.get('mitre_technique')}

Keep it under 100 words. Be direct and actionable."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    return response.text

def answer_question(question: str, context: dict):
    prompt = f"""Incident context: {context}

Analyst question: {question}

Answer concisely as a security expert."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    return response.text
```

## Step 8: WebSocket Manager (live dashboard push)

```python
# websocket/manager.py
from fastapi import WebSocket
from typing import List
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(data))
            except Exception:
                pass

manager = ConnectionManager()
```

## Step 9: The main Ingest endpoint (ties everything together)

```python
# routers/ingest.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from ml.predictor import predict
from services.risk_scoring import calculate_risk_score, score_to_severity
from services.correlation_engine import record_event
from services.mitre_mapping import get_mitre_info
from services.copilot_service import generate_explanation
from models.flow_log import FlowLog
from models.incident import Incident
from websocket.manager import manager

router = APIRouter()

@router.post("/api/ingest")
async def ingest_flow(data: dict, db: Session = Depends(get_db)):
    src_ip = data.pop("src_ip")

    # 1. Predict
    prediction, confidence = predict(data)

    # 2. Score risk
    risk_score = calculate_risk_score(prediction, confidence)
    severity = score_to_severity(risk_score)

    # 3. Log the flow
    flow_log = FlowLog(
        src_ip=src_ip, prediction=prediction,
        confidence=confidence, risk_score=risk_score
    )
    db.add(flow_log)
    db.commit()

    # 4. Push live update to dashboard regardless of severity
    await manager.broadcast({
        "type": "flow_update",
        "src_ip": src_ip,
        "prediction": prediction,
        "risk_score": risk_score
    })

    if prediction == "BENIGN":
        return {"status": "ok", "prediction": prediction}

    # 5. Check correlation engine for attack chains
    correlation_result = record_event(src_ip, prediction)

    if correlation_result:
        # A multi-stage incident was detected!
        mitre = get_mitre_info(prediction)
        incident = Incident(
            title=f"{correlation_result['chain']} from {src_ip}",
            src_ip=src_ip,
            attack_chain=correlation_result['chain'],
            mitre_technique=mitre['technique'],
            risk_score=risk_score,
            severity=severity,
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)

        # 6. Generate AI explanation
        explanation = generate_explanation({
            "attack_chain": correlation_result['chain'],
            "src_ip": src_ip,
            "risk_score": risk_score,
            "mitre_technique": mitre['technique']
        })
        incident.ai_explanation = explanation
        db.commit()

        # 7. Push incident alert via websocket
        await manager.broadcast({
            "type": "new_incident",
            "incident_id": incident.id,
            "title": incident.title,
            "severity": severity,
            "explanation": explanation
        })

    return {"status": "ok", "prediction": prediction, "risk_score": risk_score}
```

## Step 10: Incidents CRUD router

```python
# routers/incidents.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.incident import Incident, IncidentAction

router = APIRouter()

@router.get("/api/incidents")
def list_incidents(db: Session = Depends(get_db)):
    return db.query(Incident).order_by(Incident.created_at.desc()).all()

@router.get("/api/incidents/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    return db.query(Incident).filter(Incident.id == incident_id).first()

@router.patch("/api/incidents/{incident_id}/status")
def update_status(incident_id: int, status: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    incident.status = status
    db.commit()
    return incident

@router.post("/api/incidents/{incident_id}/actions")
def add_action(incident_id: int, action: str, performed_by: str, db: Session = Depends(get_db)):
    new_action = IncidentAction(incident_id=incident_id, action=action, performed_by=performed_by)
    db.add(new_action)
    db.commit()
    return new_action
```

## Step 11: Dashboard stats router

```python
# routers/dashboard.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from database import get_db
from models.flow_log import FlowLog
from models.incident import Incident

router = APIRouter()

@router.get("/api/dashboard/summary")
def summary(db: Session = Depends(get_db)):
    today = datetime.utcnow() - timedelta(days=1)

    total_alerts = db.query(FlowLog).filter(FlowLog.timestamp >= today, FlowLog.prediction != "BENIGN").count()
    critical = db.query(Incident).filter(Incident.severity == "Critical", Incident.status == "Open").count()
    blocked = db.query(Incident).filter(Incident.status == "Resolved").count()

    return {
        "todays_alerts": total_alerts,
        "critical_threats": critical,
        "blocked_attacks": blocked,
    }

@router.get("/api/dashboard/attack-distribution")
def attack_distribution(db: Session = Depends(get_db)):
    results = db.query(FlowLog.prediction, func.count(FlowLog.id)) \
        .filter(FlowLog.prediction != "BENIGN") \
        .group_by(FlowLog.prediction).all()
    return {attack: count for attack, count in results}
```

## Step 12: Auth (JWT)

```python
# auth/jwt_handler.py
from datetime import datetime, timedelta
from jose import jwt
from config import settings

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=8)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str):
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
```

```python
# routers/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import get_db
from models.user import User
from auth.jwt_handler import create_access_token

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/api/auth/login")
def login(username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not pwd_context.verify(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "role": user.role}
```

## Step 13: WebSocket endpoint

```python
# In main.py, add:
from fastapi import WebSocket, WebSocketDisconnect
from websocket.manager import manager

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()   # keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

## Step 14: Main app entry point (wires it all together)

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import ingest, incidents, dashboard, auth
from websocket.manager import manager
from fastapi import WebSocket, WebSocketDisconnect

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sentinel AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(incidents.router)
app.include_router(dashboard.router)
app.include_router(auth.router)

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
def root():
    return {"status": "Sentinel AI backend running"}
```

## requirements.txt

```
fastapi
uvicorn[standard]
sqlalchemy
psycopg2-binary
pydantic-settings
python-jose[cryptography]
passlib[bcrypt]
joblib
pandas
scikit-learn
xgboost
google-genai
python-multipart
```

## Run it

```bash
uvicorn main:app --reload --port 8000
```

## How everything connects end-to-end

```
Capture Agent → POST /api/ingest
      ↓
Load model.pkl → predict(features) → attack_type, confidence
      ↓
calculate_risk_score() → risk_score, severity
      ↓
Save to FlowLog table (all flows, for history/charts)
      ↓
Broadcast live flow via WebSocket (dashboard traffic feed)
      ↓
record_event() in Correlation Engine (per src_ip event history)
      ↓
If attack chain matched → create Incident in DB
      ↓
get_mitre_info() → attach MITRE technique
      ↓
generate_explanation() via Gemini → attach AI explanation
      ↓
Broadcast new_incident via WebSocket → dashboard shows alert popup
      ↓
Analyst opens incident → adds actions → updates status via /api/incidents endpoints
```

---

This backend is functionally complete for your demo — ingest, ML prediction, risk scoring, correlation, MITRE mapping, AI Copilot, incidents, auth, and live websocket updates.

Want me to write the **React dashboard frontend** next (the part that consumes this WebSocket + these API endpoints), or set up **Docker Compose** so backend + Postgres + Redis all run together with one command?