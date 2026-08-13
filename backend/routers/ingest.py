# Ingest router — receives flow features from the capture agent, runs prediction,
# stores the result, and pushes live updates to connected dashboard clients.
#
# Auth: protected by a static X-Agent-Key header (not JWT) because the capture agent
# is a machine process; human-facing JWT auth is used by all other endpoints.

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from ml.predictor import predict
from models.flow_log import FlowLog
from models.incident import Incident
from schemas.flow_schema import FlowIngestRequest, FlowIngestResponse
from services.alert_service import send_incident_alert
from services.correlation_engine import record_event
from services.copilot_service import generate_explanation
from services.mitre_mapping import get_mitre_info
from services.risk_scoring import calculate_risk_score, score_to_severity
from websocket.manager import manager

router = APIRouter(prefix="/api", tags=["ingest"])
logger = logging.getLogger(__name__)


def _verify_agent_key(x_agent_key: str = Header(...)):
    """FastAPI dependency that validates the static agent API key header.

    The capture agent must include 'X-Agent-Key: <value>' matching AGENT_INGEST_KEY in .env.
    """
    if x_agent_key != settings.AGENT_INGEST_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing agent key",
        )


# curl example:
#   curl -X POST http://localhost:8000/api/ingest \
#     -H "Content-Type: application/json" \
#     -H "X-Agent-Key: change-this-agent-key" \
#     -d '{
#       "src_ip": "192.168.1.50",
#       "flow_duration": 12345,
#       "total_fwd_packets": 10,
#       "total_bwd_packets": 8,
#       "total_length_fwd_packets": 1200,
#       "total_length_bwd_packets": 980,
#       "flow_bytes_per_second": 450.5,
#       "flow_packets_per_second": 3.2,
#       "flow_iat_mean": 250.0,
#       "flow_iat_std": 45.0,
#       "flow_iat_max": 800.0,
#       "flow_iat_min": 10.0,
#       "syn_flag_count": 1,
#       "ack_flag_count": 5,
#       "rst_flag_count": 0,
#       "fin_flag_count": 1,
#       "psh_flag_count": 3,
#       "packet_length_mean": 120.0,
#       "packet_length_std": 30.0,
#       "min_packet_length": 60,
#       "max_packet_length": 200
#     }'
@router.post("/ingest", response_model=FlowIngestResponse, dependencies=[Depends(_verify_agent_key)])
async def ingest_flow(data: FlowIngestRequest, db: Session = Depends(get_db)):
    """Receive a flow feature record from the capture agent and run the full detection pipeline.

    Input: FlowIngestRequest — src_ip plus all model feature fields (snake_case keys).
    Output: FlowIngestResponse — prediction class, confidence, risk score, severity.

    Pipeline: predict -> risk score -> save FlowLog -> broadcast -> correlate ->
              if chain: create Incident -> AI explanation -> broadcast incident alert.
    """
    src_ip = data.src_ip
    # Pull the extra feature fields out of the Pydantic model as a plain dict.
    features = data.model_extra

    # 1. Run ML prediction. Raises ValueError if required features are missing.
    try:
        prediction, confidence = predict(features)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    # 2. Compute risk score and severity label.
    risk_score = calculate_risk_score(prediction, confidence)
    severity = score_to_severity(risk_score)

    # 3. Persist the raw flow log regardless of prediction class.
    flow_log = FlowLog(
        src_ip=src_ip,
        prediction=prediction,
        confidence=confidence,
        risk_score=risk_score,
    )
    db.add(flow_log)
    db.commit()

    # 4. Push a live update to all connected dashboard clients.
    await manager.broadcast({
        "type": "flow_update",
        "src_ip": src_ip,
        "prediction": prediction,
        "risk_score": risk_score,
    })

    if prediction == "BENIGN":
        return FlowIngestResponse(
            status="ok",
            prediction=prediction,
            confidence=confidence,
            risk_score=risk_score,
            severity=severity,
        )

    # 5. Feed into the correlation engine to detect multi-stage attack chains.
    correlation_result = record_event(src_ip, prediction)

    if correlation_result:
        mitre = get_mitre_info(prediction)
        incident = Incident(
            title=f"{correlation_result['chain']} from {src_ip}",
            src_ip=src_ip,
            attack_chain=correlation_result["chain"],
            mitre_technique=mitre["technique"],
            risk_score=risk_score,
            severity=severity,
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)

        # 6. Generate a plain-English explanation via Gemini (degrades gracefully if key absent).
        explanation = generate_explanation({
            "attack_chain": correlation_result["chain"],
            "src_ip": src_ip,
            "risk_score": risk_score,
            "mitre_technique": mitre["technique"],
        })
        incident.ai_explanation = explanation
        db.commit()

        # 7. Broadcast the new incident to the dashboard.
        await manager.broadcast({
            "type": "new_incident",
            "incident_id": incident.id,
            "title": incident.title,
            "severity": severity,
            "explanation": explanation,
        })

        # 8. Fire alert notifications (email / Telegram stubs).
        send_incident_alert(incident.title, severity, src_ip)

        logger.info(f"Incident created: id={incident.id} chain={correlation_result['chain']} ip={src_ip}")

    return FlowIngestResponse(
        status="ok",
        prediction=prediction,
        confidence=confidence,
        risk_score=risk_score,
        severity=severity,
    )
