from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String, Text, Boolean
from app.models.base import Base

class ServiceType(Base):
    """Registry of all service categories offered on the platform."""

    __tablename__ = "service_types"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    key          = Column(String(50), nullable=False, unique=True, index=True)   # e.g. "electrician"
    label        = Column(String(100), nullable=False)                            # e.g. "Electrician"
    label_urdu   = Column(String(100), nullable=False)                            # e.g. "BIJLI WALA"
    theme_color  = Column(String(20), nullable=False, default="#3B82F6")          # CSS hex color
    description  = Column(Text, nullable=False)                                   # Roman Urdu description
    aliases      = Column(Text, nullable=True)                                    # Comma-separated Roman Urdu keywords
    sort_order   = Column(Integer, nullable=False, default=0)                     # display order
    is_active    = Column(Boolean, nullable=False, default=True)
    created_at   = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<ServiceType(key='{self.key}', label='{self.label}')>"
