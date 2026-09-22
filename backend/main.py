# FastAPI application entry point — wires together all routers, middleware,
# WebSocket endpoint, and ensures DB tables exist at startup.

import logging

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError

from auth.jwt_handler import decode_token
from config import settings
import models  # noqa: F401 — importing the package runs __init__.py which registers all models
from database import Base, engine
from routers import auth, copilot, dashboard, incidents, ingest
from websocket.manager import manager

logging.basicConfig(level=logging.INFO)

if not settings.AGENT_INGEST_KEY:
    raise RuntimeError("AGENT_INGEST_KEY must be set in backend/.env before starting the backend")

# Create all tables that have been registered via Base.metadata.
# This is safe to call on every startup — SQLAlchemy skips tables that already exist.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sentinel AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.FRONTEND_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ingest.router)
app.include_router(incidents.router)
app.include_router(dashboard.router)
app.include_router(copilot.router)


@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket, token: str | None = Query(None)):
    """Live push channel — the React dashboard connects here to receive real-time flow and incident events."""
    if not settings.DISABLE_AUTH:
        if not token:
            await websocket.close(code=1008, reason="Authentication required")
            return
        try:
            payload = decode_token(token)
            if payload.get("sub") is None:
                raise JWTError("Token payload is missing the user identity claim")
        except JWTError:
            await websocket.close(code=1008, reason="Authentication required")
            return

    await manager.connect(websocket)
    try:
        # Keep the connection alive by waiting for any incoming text (ping frames).
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/")
def root():
    """Health-check endpoint."""
    return {"status": "Sentinel AI backend running"}
