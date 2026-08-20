from sqlalchemy import Column, Float, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class Provider(Base):
    """A local service provider linked to a user for distance-based sorting."""

    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True, index=True)
    name = Column(String(100), nullable=False)
    service_type_id = Column(Integer, ForeignKey("service_types.id"), nullable=False, index=True)
    location = Column(String(200), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    rating = Column(Float, nullable=False, default=5.0)
    rating_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="Active")
    is_available = Column(Boolean, nullable=False, default=True, server_default="1")
    experience_years = Column(Integer, nullable=True)
    bio = Column(Text, nullable=True)
    
    user = relationship("User", back_populates="provider_profile", foreign_keys=[user_id])
    service_type_obj = relationship("ServiceType", backref="providers", foreign_keys=[service_type_id])

    @property
    def get_service_type_label(self) -> str:
        """Helper property so provider.get_service_type_label returns label string seamlessly."""
        return self.service_type_obj.label if self.service_type_obj else "Unknown"

    def __repr__(self) -> str:
        return f"<Provider(id={self.id}, name='{self.name}', service_type_id={self.service_type_id})>"
