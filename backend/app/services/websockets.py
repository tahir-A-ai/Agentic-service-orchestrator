"""WebSocket connection manager with optional distributed Redis Pub/Sub support."""
import asyncio
import json
import logging
import uuid
from typing import Dict, List, Optional
from fastapi import WebSocket

from app.core.config import settings

logger = logging.getLogger(__name__)

# Unique ID per worker process so this worker can distinguish its own
# published events from events published by other worker processes.
WORKER_ID: str = uuid.uuid4().hex


class RedisPubSubBridge:
    """Distributed Redis Pub/Sub bridge for WebSockets.
    
    In multi-worker / multi-instance environments (e.g. AWS ALB + EC2),
    Worker 1 might accept a customer's WebSocket connection while Worker 2
    handles the provider's HTTP request to change status.
    
    This bridge ensures events published on any worker are fanned out
    across Redis to all workers, who deliver them to their local WebSockets.
    
    If REDIS_URL is not set or Redis is unreachable, it seamlessly operates
    in single-process local mode without errors.
    """

    def __init__(self):
        self._redis = None
        self._pubsub = None
        self._listener_task: Optional[asyncio.Task] = None
        self._is_connected: bool = False

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    async def start(self) -> None:
        if not settings.REDIS_URL:
            logger.info("REDIS_URL not configured. Running WebSockets in local in-memory mode.")
            return

        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5.0,
            )
            self._pubsub = self._redis.pubsub()
            await self._pubsub.psubscribe("ws:*")
            self._is_connected = True
            self._listener_task = asyncio.create_task(self._listen_loop())
            logger.info("Redis Pub/Sub connected for WebSocket clustering (Worker ID: %s)", WORKER_ID[:8])
        except Exception as exc:
            self._is_connected = False
            logger.warning("Could not connect to Redis Pub/Sub (%s). Falling back to local mode.", exc)

    async def stop(self) -> None:
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self._pubsub:
            try:
                await self._pubsub.punsubscribe("ws:*")
                await self._pubsub.close()
            except Exception:
                pass
        if self._redis:
            try:
                await self._redis.close()
            except Exception:
                pass
        self._is_connected = False

    async def publish(self, channel: str, message: dict) -> None:
        if not self._is_connected or not self._redis:
            return
        envelope = {
            "_src": WORKER_ID,
            "data": message,
        }
        try:
            await self._redis.publish(channel, json.dumps(envelope))
        except Exception as exc:
            logger.warning("Redis publish failed on channel %s: %s", channel, exc)

    async def _listen_loop(self) -> None:
        try:
            async for msg in self._pubsub.listen():
                if msg.get("type") != "pmessage":
                    continue
                channel = msg.get("channel", "")
                raw_data = msg.get("data")
                if not raw_data:
                    continue
                try:
                    envelope = json.loads(raw_data)
                except Exception:
                    continue

                # Ignore messages published by this worker process (already dispatched locally)
                if envelope.get("_src") == WORKER_ID:
                    continue

                payload = envelope.get("data")
                if not payload:
                    continue

                # Dispatch according to channel naming convention:
                # ws:job:<job_id>
                # ws:provider:<provider_id>
                if channel.startswith("ws:job:"):
                    job_id = channel.split("ws:job:", 1)[1]
                    await manager._dispatch_local(job_id, payload)
                elif channel.startswith("ws:provider:"):
                    try:
                        provider_id = int(channel.split("ws:provider:", 1)[1])
                        await provider_manager._dispatch_local(provider_id, payload)
                    except ValueError:
                        pass
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("Redis Pub/Sub listener encountered error: %s", exc)
            self._is_connected = False


redis_bridge = RedisPubSubBridge()


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

    async def _dispatch_local(self, job_id: str, message: dict):
        if job_id in self.active_connections:
            for connection in list(self.active_connections[job_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(connection, job_id)

    async def broadcast_to_job(self, job_id: str, message: dict):
        # 1. Immediately dispatch to local connections on this worker
        await self._dispatch_local(job_id, message)
        # 2. Fanout via Redis Pub/Sub to all other worker processes/instances
        if redis_bridge.is_connected:
            await redis_bridge.publish(f"ws:job:{job_id}", message)


manager = ConnectionManager()


class ProviderConnectionManager:
    """Per-provider WebSocket registry for dashboard stat pushes."""

    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, provider_id: int):
        await websocket.accept()
        if provider_id not in self.active_connections:
            self.active_connections[provider_id] = []
        self.active_connections[provider_id].append(websocket)

    def disconnect(self, websocket: WebSocket, provider_id: int):
        if provider_id in self.active_connections:
            if websocket in self.active_connections[provider_id]:
                self.active_connections[provider_id].remove(websocket)
            if not self.active_connections[provider_id]:
                del self.active_connections[provider_id]

    async def _dispatch_local(self, provider_id: int, payload: dict):
        if provider_id in self.active_connections:
            for ws in list(self.active_connections[provider_id]):
                try:
                    await ws.send_json(payload)
                except Exception:
                    self.disconnect(ws, provider_id)

    async def push_stats(self, provider_id: int, stats: dict):
        """Push a stats_update payload to all dashboard sockets for this provider."""
        payload = {"type": "stats_update", **stats}
        await self._dispatch_local(provider_id, payload)
        if redis_bridge.is_connected:
            await redis_bridge.publish(f"ws:provider:{provider_id}", payload)

    async def push_event(self, provider_id: int, event: dict):
        """Push any arbitrary typed event to all dashboard sockets for this provider."""
        await self._dispatch_local(provider_id, event)
        if redis_bridge.is_connected:
            await redis_bridge.publish(f"ws:provider:{provider_id}", event)


provider_manager = ProviderConnectionManager()
