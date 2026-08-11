"""WebSocket connection manager."""


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections = []

    async def connect(self, websocket) -> None:
        self.active_connections.append(websocket)

    def disconnect(self, websocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
