from sqlalchemy import Column, Float, Integer, String, Text
from app.models.base import Base

class LocationCache(Base):
    """Cache of geocoded locations to avoid redundant Nominatim API calls."""

    __tablename__ = "location_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query = Column(Text, nullable=False, unique=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    def __repr__(self) -> str:
        return f"<LocationCache(query='{self.query}', lat={self.latitude}, lon={self.longitude})>"
