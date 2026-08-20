"""Chat conversation persistence model."""

import json
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String, Text, ForeignKey
from app.models.base import Base

MAX_MESSAGES = 100  # Maximum messages stored per conversation


class ChatConversation(Base):
    """Stores the UI message history for a customer chat session.

    The `id` matches the LangGraph thread_id / BookingSession.id so they can
    be correlated without an extra join.  Messages are stored as a JSON array
    (max MAX_MESSAGES entries — oldest are silently truncated on write).
    Rows older than 90 days (relative to updated_at) are eligible for deletion.
    """

    __tablename__ = "chat_conversations"

    id = Column(String(36), primary_key=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    messages = Column(Text, nullable=False, default="[]")
    booking_session_id = Column(
        String(36),
        ForeignKey("booking_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


    def get_messages(self) -> list:
        """Return the conversation's stored messages as a list.
        
        Returns:
        	list: The decoded messages, or an empty list when the stored value is invalid or not a string.
        """
        try:
            return json.loads(self.messages)
        except (json.JSONDecodeError, TypeError):
            return []

    def set_messages(self, msgs: list) -> None:
        """
        Store the newest messages as a JSON-encoded string.
        
        Parameters:
            msgs (list): Messages to store; only the newest 100 are retained.
        """
        if len(msgs) > MAX_MESSAGES:
            msgs = msgs[-MAX_MESSAGES:]
        self.messages = json.dumps(msgs, ensure_ascii=False)

    def __repr__(self) -> str:
        """Return a concise representation containing the conversation and customer IDs."""
        return f"<ChatConversation(id='{self.id}', customer_id={self.customer_id})>"
