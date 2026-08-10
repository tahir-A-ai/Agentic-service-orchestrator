from pydantic import BaseModel

class PublicStatsResponse(BaseModel):
    providers_registered: int
    bookings_completed: int
    average_rating: float
