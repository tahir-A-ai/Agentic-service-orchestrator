"""Pydantic schemas for chat conversation endpoints."""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    """A single chat message (user or agent)."""
    id: str
    role: str  # 'user' | 'agent'
    type: str  # 'text' | 'candidates' | 'clarification'
    content: str
    candidates: dict[str, Any] | None = None


class ConversationSyncRequest(BaseModel):
    """Payload sent by the frontend to persist the current message array."""
    title: str = Field(..., min_length=1, max_length=100)
    messages: list[ChatMessage] = Field(..., max_length=100, description="Full current message array (max 100).")
    booking_session_id: str | None = None


class ConversationListItem(BaseModel):
    """Lightweight entry for the sidebar list — no messages payload."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationDetail(BaseModel):
    """Full conversation including all messages — returned on lazy load."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    messages: list[ChatMessage]
    booking_session_id: str | None
    created_at: datetime
    updated_at: datetime



class ConversationListResponse(BaseModel):
    conversations: list[ConversationListItem]
    has_more: bool
    total: int
