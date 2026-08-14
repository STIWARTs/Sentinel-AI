from services.alert_service import send_incident_alert

send_incident_alert(
    incident_title="Test Attack",
    severity="HIGH",
    src_ip="192.168.1.100"
)
