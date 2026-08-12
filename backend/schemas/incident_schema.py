# Pydantic schemas for incident-related endpoints.
# Separate request and response models keep validation explicit and avoid leaking ORM internals.

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class IncidentResponse(BaseModel):
    id: int
    title: str
    src_ip: str
    attack_chain: str
    mitre_technique: str
    risk_score: int
    severity: str
    status: str
    assigned_to: Optional[str]
    ai_explanation: Optional[str]
    created_at: datetime
    updated_at: datetime

    # orm_mode lets Pydantic read attributes off a SQLAlchemy model instance directly.
    model_config = {"from_attributes": True}


class IncidentStatusUpdate(BaseModel):
    # Only the status field is patchable via the PATCH endpoint.
    status: str   # expected values: Open / In Progress / Resolved


class IncidentActionRequest(BaseModel):
    action: str        # free-text description of what the analyst did
    performed_by: str  # analyst username, supplied by the client


class IncidentActionResponse(BaseModel):
    id: int
    incident_id: int
    action: str
    performed_by: str
    timestamp: datetime

    model_config = {"from_attributes": True}
