# Risk scoring service — converts a prediction + confidence into a 0-100 score
# and maps that score to a human-readable severity label.

# Base scores per attack type, set by threat severity judgment rather than any formula.
# BENIGN has no base score because it is explicitly excluded before scoring.
ATTACK_BASE_SCORE: dict[str, int] = {
    "BENIGN": 0,
    "PortScan": 40,
    "BruteForce": 55,
    "DDoS": 75,
    "Bot": 65,
}


def calculate_risk_score(
    attack_type: str,
    confidence: float,
    is_known_malicious_ip: bool = False,
) -> int:
    """Compute a 0-100 risk score from attack type, model confidence, and optional threat intel.

    Multiplying base score by confidence means a low-confidence prediction produces a lower
    score than the same attack type predicted with high confidence — this avoids over-alerting
    on uncertain model outputs.
    """
    if attack_type == "BENIGN":
        return 0

    base = ATTACK_BASE_SCORE.get(attack_type, 30)
    score = base * confidence

    if is_known_malicious_ip:
        # Bump score if external threat intel flags the source IP as previously malicious.
        score += 15

    return min(int(score), 100)


def score_to_severity(score: int) -> str:
    """Map a numeric risk score to a severity label used throughout the UI and DB."""
    if score >= 80:
        return "Critical"
    elif score >= 60:
        return "High"
    elif score >= 30:
        return "Medium"
    return "Low"
