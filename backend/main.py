# FastAPI application entry point — wires together all routers, middleware,
# WebSocket endpoint, and ensures DB tables exist at startup.

import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401 — importing the package runs __init__.py which registers all models
from database import Base, engine
from routers import auth, copilot, dashboard, incidents, ingest
from websocket.manager import manager

logging.basicConfig(level=logging.INFO)

# Create all tables that have been registered via Base.metadata.
# This is safe to call on every startup — SQLAlchemy skips tables that already exist.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sentinel AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    # Restrict origins in production to the actual frontend URL.
    allow_origins=["*"],
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
async def websocket_endpoint(websocket: WebSocket):
    """Live push channel — the React dashboard connects here to receive real-time flow and incident events."""
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
