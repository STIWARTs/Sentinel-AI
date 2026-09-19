# Alert service — sends notifications when a new incident is created.
# Gemini-generated incident explanation is included in Email and Telegram alerts.

import logging
import requests
import smtplib

from config import settings

logger = logging.getLogger(__name__)


def send_incident_alert(
    incident_title: str,
    severity: str,
    src_ip: str,
    explanation: str,
) -> None:
    """Send incident alert through Email and Telegram with Gemini explanation."""

    _send_email_alert(
        incident_title,
        severity,
        src_ip,
        explanation,
    )

    _send_telegram_alert(
        incident_title,
        severity,
        src_ip,
        explanation,
    )


def _send_email_alert(
    incident_title: str,
    severity: str,
    src_ip: str,
    explanation: str,
) -> None:
    """Send Email notification via SMTP."""

    if not settings.SMTP_HOST:
        return

    message = (
        f"Subject: [SENTINEL AI] {severity} Security Alert\r\n"
        f"From: {settings.SMTP_USER}\r\n"
        f"To: {settings.ALERT_EMAIL_TO}\r\n"
        "\r\n"
        "SENTINEL AI SECURITY ALERT\r\n"
        "\r\n"
        f"Incident: {incident_title}\r\n"
        f"Severity: {severity}\r\n"
        f"Source IP: {src_ip}\r\n"
        "\r\n"
        "AI ANALYSIS:\r\n"
        f"{explanation}\r\n"
    )

    try:
        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=20,
        ) as server:

            server.ehlo()
            server.starttls()
            server.ehlo()

            server.login(
                settings.SMTP_USER,
                settings.SMTP_PASSWORD,
            )

            server.sendmail(
                settings.SMTP_USER,
                settings.ALERT_EMAIL_TO,
                message,
            )

        logger.info("Email alert sent successfully.")

    except Exception as e:
        logger.error(f"Failed to send email alert: {e}")


def _send_telegram_alert(
    incident_title: str,
    severity: str,
    src_ip: str,
    explanation: str,
) -> None:
    """Send Telegram notification via Bot API."""

    if not settings.TELEGRAM_BOT_TOKEN:
        return

    message = (
        "🚨 SENTINEL AI SECURITY ALERT\n\n"
        f"Incident: {incident_title}\n"
        f"Severity: {severity}\n"
        f"Source IP: {src_ip}\n\n"
        "🤖 AI ANALYSIS:\n"
        f"{explanation}"
    )

    url = (
        f"https://api.telegram.org/"
        f"bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    )

    payload = {
        "chat_id": settings.TELEGRAM_CHAT_ID,
        "text": message,
    }

    try:
        response = requests.post(
            url,
            json=payload,
            timeout=10,
        )

        response.raise_for_status()

        logger.info("Telegram alert sent successfully.")

    except requests.RequestException as e:
        logger.error(
            f"Failed to send Telegram alert: {e}"
        )