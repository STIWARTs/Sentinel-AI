# Incidents router — CRUD endpoints for viewing and managing detected incidents.
#
# Role permissions:
#   GET endpoints  — viewer and above (any authenticated user)
#   PATCH status   — analyst and above
#   POST actions   — analyst and above

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_role
from database import get_db
from models.incident import Incident, IncidentAction
from schemas.incident_schema import (
    IncidentActionRequest,
    IncidentActionResponse,
    IncidentResponse,
    IncidentStatusUpdate,
)

router = APIRouter(prefix="/api/incidents", tags=["incidents"])
logger = logging.getLogger(__name__)


# curl example:
#   curl http://localhost:8000/api/incidents \
#     -H "Authorization: Bearer <token>"
@router.get("", response_model=list[IncidentResponse])
def list_incidents(
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("viewer")),
):
    """Return all incidents ordered most-recent first.

    Input: none (query params for filtering can be added later).
    Output: list of IncidentResponse.
    """
    return db.query(Incident).order_by(Incident.created_at.desc()).all()


# curl example:
#   curl http://localhost:8000/api/incidents/1 \
#     -H "Authorization: Bearer <token>"
@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("viewer")),
):
    """Return a single incident by ID.

    Input: incident_id path parameter.
    Output: IncidentResponse, or 404 if not found.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


# curl example:
#   curl -X PATCH http://localhost:8000/api/incidents/1/status \
#     -H "Authorization: Bearer <token>" \
#     -H "Content-Type: application/json" \
#     -d '{"status": "In Progress"}'
@router.patch("/{incident_id}/status", response_model=IncidentResponse)
def update_incident_status(
    incident_id: int,
    body: IncidentStatusUpdate,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("analyst")),
):
    """Update an incident's status (Open / In Progress / Resolved).

    Input: IncidentStatusUpdate (status field).
    Output: updated IncidentResponse.
    Requires analyst role or higher.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    incident.status = body.status
    db.commit()
    db.refresh(incident)
    logger.info(f"Incident {incident_id} status updated to '{body.status}'")
    return incident


# curl example:
#   curl -X POST http://localhost:8000/api/incidents/1/actions \
#     -H "Authorization: Bearer <token>" \
#     -H "Content-Type: application/json" \
#     -d '{"action": "Blocked source IP at firewall", "performed_by": "analyst1"}'
@router.post("/{incident_id}/actions", response_model=IncidentActionResponse)
def add_incident_action(
    incident_id: int,
    body: IncidentActionRequest,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("analyst")),
):
    """Log an analyst action taken on this incident (e.g. blocked IP, escalated).

    Input: IncidentActionRequest (action description, performed_by username).
    Output: IncidentActionResponse with the new action record.
    Requires analyst role or higher.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    new_action = IncidentAction(
        incident_id=incident_id,
        action=body.action,
        performed_by=body.performed_by,
    )
    db.add(new_action)
    db.commit()
    db.refresh(new_action)
    return new_action
