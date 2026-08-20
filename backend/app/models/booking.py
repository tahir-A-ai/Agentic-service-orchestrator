from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.models.base import Base

class BookingSession(Base):
    """Persistent state between Phase 1 (find providers) and Phase 2 (confirm booking)."""

    __tablename__ = "booking_sessions"

    id = Column(String(36), primary_key=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    candidates = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    confirmed_provider_id = Column(Integer, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    exact_address = Column(String(255), nullable=True)
    customer_notes = Column(Text, nullable=True)
    customer_rating = Column(Integer, nullable=True)
    customer_review = Column(Text, nullable=True)
    customer_confirmed_at = Column(DateTime, nullable=True)
    cancelled_by = Column(SAEnum('customer', 'provider', name='cancelled_by_enum'), nullable=True)

    def __repr__(self) -> str:
        """Return a concise representation containing the booking session ID and status."""
        return f"<BookingSession(id='{self.id}', status='{self.status}')>"


class SessionDecline(Base):
    """Junction table recording provider job declines for scalable relational analytics."""
    __tablename__ = "session_declines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("booking_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    session = relationship("BookingSession", backref="declines", foreign_keys=[session_id])
    provider = relationship("Provider", backref="declines", foreign_keys=[provider_id])

    def __repr__(self) -> str:
        return f"<SessionDecline(session_id='{self.session_id}', provider_id={self.provider_id})>"
