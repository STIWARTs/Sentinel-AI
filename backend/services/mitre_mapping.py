# MITRE ATT&CK mapping service — translates an attack class name to the matching
# MITRE technique ID and name for display in the incident detail view.

# Technique IDs sourced from https://attack.mitre.org (Enterprise matrix, 2024).
MITRE_MAP: dict[str, dict[str, str]] = {
    "PortScan": {"technique": "T1046", "name": "Network Service Discovery"},
    "BruteForce": {"technique": "T1110", "name": "Brute Force"},
    "DDoS": {"technique": "T1498", "name": "Network Denial of Service"},
    "Bot": {"technique": "T1071", "name": "Application Layer Protocol (C2)"},
}


def get_mitre_info(attack_type: str) -> dict[str, str]:
    """Return the MITRE technique dict for the given attack class name.

    Falls back to a generic unknown entry so callers never get a KeyError
    if a new attack class is added to the model without updating this map.
    """
    return MITRE_MAP.get(attack_type, {"technique": "N/A", "name": "Unknown"})
