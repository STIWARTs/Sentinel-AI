# Alert service — sends notifications when a new incident is created.
# Email and Telegram stubs are provided; actual credentials come from config.py / .env.
#
# TODO (Step3 Part II): implement SMTP send and Telegram Bot API call.
# Required env vars (add to .env when ready):
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, ALERT_EMAIL_TO
#   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

import logging
import requests
import smtplib

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
    """Send an email notification via SMTP."""
    if not settings.SMTP_HOST:
        return

    message = (
        f"Subject: [SENTINEL AI] {severity} Security Alert\n"
        f"From: {settings.SMTP_USER}\n"
        f"To: {settings.ALERT_EMAIL_TO}\n"
        "\n"
        "SENTINEL AI SECURITY ALERT\n\n"
        f"Incident: {incident_title}\n"
        f"Severity: {severity}\n"
        f"Source IP: {src_ip}\n"
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(
                settings.SMTP_USER,
                settings.ALERT_EMAIL_TO,
                message,
            )

        logger.info("Email alert sent successfully.")

    except Exception as e:
        logger.error(f"Failed to send email alert: {e}")

def _send_telegram_alert(incident_title: str, severity: str, src_ip: str) -> None:
    """Send a Telegram message via Bot API."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return

    message = (
        "🚨 SENTINEL AI SECURITY ALERT\n\n"
        f"Incident: {incident_title}\n"
        f"Severity: {severity}\n"
        f"Source IP: {src_ip}"
    )

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"

    payload = {
        "chat_id": settings.TELEGRAM_CHAT_ID,
        "text": message,
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info("Telegram alert sent successfully.")
    except requests.RequestException as e:
        logger.error(f"Failed to send Telegram alert: {e}")