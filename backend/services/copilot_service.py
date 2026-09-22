# AI Copilot service — wraps the Google Gemini API to explain incidents
# and answer analyst questions in plain English.
#
# Both functions degrade gracefully when GEMINI_API_KEY is blank, returning None
# rather than crashing. The ingest pipeline treats None as "no explanation available".

import logging

from config import settings

logger = logging.getLogger(__name__)


def _get_client():
    """Create and return a Gemini genai Client, or None if the API key is not configured."""
    if not settings.GEMINI_API_KEY:
        return None
    try:
        from google import genai
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    except ImportError:
        logger.warning("google-genai package not installed; copilot features are disabled")
        return None


def generate_explanation(incident_data: dict) -> str | None:
    """Ask Gemini to explain a detected incident in plain English for a junior analyst.

    Returns the explanation string, or None if the API key is absent or the call fails.
    """
    client = _get_client()
    if client is None:
        return None

    prompt = (
        f"You are a cybersecurity analyst assistant. Explain this detected incident "
        f"in plain English for a junior security analyst, and recommend next steps.\n\n"
        f"Attack chain: {incident_data.get('attack_chain')}\n"
        f"Source IP: {incident_data.get('src_ip')}\n"
        f"Risk Score: {incident_data.get('risk_score')}/100\n"
        f"MITRE Technique: {incident_data.get('mitre_technique')}\n\n"
        f"Keep it under 100 words. Be direct and actionable."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text
    except Exception as exc:
        logger.error(f"Gemini API call failed in generate_explanation: {exc}")
        return None


def answer_question(question: str, context: dict) -> str | None:
    """Answer a free-form analyst question about an incident using Gemini.

    Returns the answer string, or None if the API key is absent or the call fails.
    """
    client = _get_client()
    if client is None:
        return None

    prompt = (
        f"Incident context: {context}\n\n"
        f"Analyst question: {question}\n\n"
        f"Answer concisely as a security expert."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text
    except Exception as exc:
        logger.error(f"Gemini API call failed in answer_question: {exc}")
        return None
