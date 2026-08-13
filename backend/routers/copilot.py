# Copilot router — allows analysts to ask free-form questions about an incident
# and get a concise answer from Gemini via the copilot service.
# Requires at least analyst role (viewers are read-only).

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import require_role
from schemas.auth_schema import CopilotAskRequest, CopilotAskResponse
from services.copilot_service import answer_question

router = APIRouter(prefix="/api/copilot", tags=["copilot"])
logger = logging.getLogger(__name__)


# curl example:
#   curl -X POST http://localhost:8000/api/copilot/ask \
#     -H "Authorization: Bearer <token>" \
#     -H "Content-Type: application/json" \
#     -d '{
#       "question": "Should I block this IP at the perimeter firewall?",
#       "incident_context": {
#         "attack_chain": "PortScan -> BruteForce",
#         "src_ip": "192.168.1.50",
#         "risk_score": 72,
#         "mitre_technique": "T1110"
#       }
#     }'
@router.post("/ask", response_model=CopilotAskResponse)
def ask_copilot(
    body: CopilotAskRequest,
    _user: dict = Depends(require_role("analyst")),
):
    """Send a free-form question about an incident to the AI Copilot and get an answer.

    Input: CopilotAskRequest (question string, incident_context dict).
    Output: CopilotAskResponse (answer string).
    Returns 503 if the Gemini API key is not configured.
    Requires analyst role or higher.
    """
    answer = answer_question(body.question, body.incident_context)

    if answer is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Copilot is not available: GEMINI_API_KEY is not configured",
        )

    return CopilotAskResponse(answer=answer)
