# Alert service — sends notifications when a new incident is created.
# Email and Telegram stubs are provided; actual credentials come from config.py / .env.
#
# TODO (Step3 Part II): implement SMTP send and Telegram Bot API call.
# Required env vars (add to .env when ready):
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, ALERT_EMAIL_TO
#   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

import logging

from config import settings

logger = logging.getLogger(__name__)


def send_incident_alert(incident_title: str, severity: str, src_ip: str) -> None:
    """Dispatch an email and/or Telegram notification for a newly created incident.

    Both channels are skipped silently if the relevant credentials are not configured,
    so the ingest pipeline is never blocked by a missing alert integration.
    """
    _send_email_alert(incident_title, severity, src_ip)
    _send_telegram_alert(incident_title, severity, src_ip)


def _send_email_alert(incident_title: str, severity: str, src_ip: str) -> None:
    """Send an email notification via SMTP. No-op if SMTP_HOST is not configured."""
    if not settings.SMTP_HOST:
        return

    # TODO: implement smtplib send here once SMTP credentials are available.
    # Use settings.SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, ALERT_EMAIL_TO.
    logger.info(f"Email alert stub called for incident: {incident_title} ({severity})")


def _send_telegram_alert(incident_title: str, severity: str, src_ip: str) -> None:
    """Send a Telegram message via Bot API. No-op if TELEGRAM_BOT_TOKEN is not configured."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return

    # TODO: implement requests.post to Telegram sendMessage API here.
    # URL: https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage
    # Payload: {"chat_id": settings.TELEGRAM_CHAT_ID, "text": message}
    logger.info(f"Telegram alert stub called for incident: {incident_title} ({severity})")
