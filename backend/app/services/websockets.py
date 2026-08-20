"""WebSocket connection manager for real-time updates."""
from fastapi import WebSocket
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, job_id: str):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = []
        self.active_connections[job_id].append(websocket)

    def disconnect(self, websocket: WebSocket, job_id: str):
        if job_id in self.active_connections:
            if websocket in self.active_connections[job_id]:
                self.active_connections[job_id].remove(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

    async def broadcast_to_job(self, job_id: str, message: dict):
        """Send a JSON message to all WebSocket connections associated with a job.
        
        Parameters:
            job_id (str): Identifier of the job whose connections receive the message.
            message (dict): JSON-serializable message payload.
        """
        if job_id in self.active_connections:
            for connection in list(self.active_connections[job_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(connection, job_id)

manager = ConnectionManager()


class ProviderConnectionManager:
    """Per-provider WebSocket registry for dashboard stat pushes."""

    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, provider_id: int):
        """Accept and register a WebSocket connection for a provider.
        
        Parameters:
            websocket (WebSocket): The connection to register.
            provider_id (int): The provider whose connections include this WebSocket.
        """
        await websocket.accept()
        if provider_id not in self.active_connections:
            self.active_connections[provider_id] = []
        self.active_connections[provider_id].append(websocket)

    def disconnect(self, websocket: WebSocket, provider_id: int):
        """Remove a provider's WebSocket connection from the active connection registry.
        
        Parameters:
        	websocket (WebSocket): The connection to remove.
        	provider_id (int): The provider whose connection registry is updated.
        """
        if provider_id in self.active_connections:
            if websocket in self.active_connections[provider_id]:
                self.active_connections[provider_id].remove(websocket)
            if not self.active_connections[provider_id]:
                del self.active_connections[provider_id]

    async def push_stats(self, provider_id: int, stats: dict):
        """Push a stats_update payload to all dashboard sockets for this provider."""
        if provider_id not in self.active_connections:
            return
        payload = {"type": "stats_update", **stats}
        for ws in list(self.active_connections[provider_id]):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(ws, provider_id)

    async def push_event(self, provider_id: int, event: dict):
        """Push any arbitrary typed event to all dashboard sockets for this provider."""
        if provider_id not in self.active_connections:
            return
        for ws in list(self.active_connections[provider_id]):
            try:
                await ws.send_json(event)
            except Exception:
                self.disconnect(ws, provider_id)


provider_manager = ProviderConnectionManager()
