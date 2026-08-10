from pydantic import BaseModel

class ServiceTypeOut(BaseModel):
    """Full service type object returned from the service-types API."""
    id: int
    key: str
    label: str
    label_urdu: str
    theme_color: str
    description: str
    sort_order: int


class ServiceTypesResponse(BaseModel):
    service_types: list[ServiceTypeOut]


class ActiveServicesResponse(BaseModel):
    """Legacy: simple list of service type labels (keys). Kept for backward compatibility."""
    active_services: list[str]
