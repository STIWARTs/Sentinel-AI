# WebSocket connection manager — maintains the set of active browser connections
# and broadcasts JSON messages to all of them for the live dashboard feed.

import json
import logging
from typing import List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection and add it to the active set."""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a disconnected WebSocket from the active set."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: dict) -> None:
        """Send a JSON-serialised message to every currently connected client.

        Each connection is wrapped in a try/except so a stale or closed socket
        does not prevent the broadcast reaching the remaining active clients.
        """
        message = json.dumps(data)
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as exc:
                logger.warning(f"WebSocket send failed, dropping connection: {exc}")


# Module-level singleton — imported by routers/ingest.py and main.py.
manager = ConnectionManager()
