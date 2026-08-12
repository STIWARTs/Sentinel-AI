# Dashboard router — aggregated statistics for the summary cards and attack distribution chart.
# All endpoints require at least viewer role (any authenticated user).

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth.dependencies import require_role
from database import get_db
from models.flow_log import FlowLog
from models.incident import Incident

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# curl example:
#   curl http://localhost:8000/api/dashboard/summary \
#     -H "Authorization: Bearer <token>"
@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("viewer")),
):
    """Return counts for the three dashboard summary cards.

    Output:
      todays_alerts    — non-benign flow log entries in the last 24 hours
      critical_threats — open incidents with Critical severity
      blocked_attacks  — incidents with Resolved status (proxy for "handled")
    """
    since = datetime.utcnow() - timedelta(days=1)

    todays_alerts = (
        db.query(FlowLog)
        .filter(FlowLog.timestamp >= since, FlowLog.prediction != "BENIGN")
        .count()
    )
    critical_threats = (
        db.query(Incident)
        .filter(Incident.severity == "Critical", Incident.status == "Open")
        .count()
    )
    blocked_attacks = (
        db.query(Incident)
        .filter(Incident.status == "Resolved")
        .count()
    )

    return {
        "todays_alerts": todays_alerts,
        "critical_threats": critical_threats,
        "blocked_attacks": blocked_attacks,
    }


# curl example:
#   curl http://localhost:8000/api/dashboard/attack-distribution \
#     -H "Authorization: Bearer <token>"
@router.get("/attack-distribution")
def get_attack_distribution(
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("viewer")),
):
    """Return a count of each non-benign attack type seen across all flow logs.

    Output: dict mapping attack class name to total occurrence count,
    e.g. {"DDoS": 120, "PortScan": 45, "BruteForce": 12}.
    """
    results = (
        db.query(FlowLog.prediction, func.count(FlowLog.id))
        .filter(FlowLog.prediction != "BENIGN")
        .group_by(FlowLog.prediction)
        .all()
    )
    return {attack: count for attack, count in results}
