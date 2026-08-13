# Correlation engine — tracks recent attack events per source IP and detects
# multi-stage attack chains (e.g. PortScan followed by BruteForce).
#
# State is in-memory: it resets on backend restart. This is an accepted limitation
# for the college demo. To persist across restarts, swap recent_events for a Redis
# sorted set (see AGENTS.md Known Gotchas).

from collections import defaultdict
from datetime import datetime, timedelta

# { src_ip: [(attack_type, timestamp), ...] }
recent_events: dict[str, list[tuple[str, datetime]]] = defaultdict(list)

# How far back to look when checking for a chain. Events older than this are discarded.
CORRELATION_WINDOW_MINUTES = 15

# Each entry is an ordered list of attack types that constitutes a detected campaign.
# Ordering matters: [A, B] means A must have been seen before B.
ATTACK_CHAINS: list[list[str]] = [
    ["PortScan", "BruteForce"],
    ["PortScan", "BruteForce", "DDoS"],
    ["BruteForce", "Bot"],
]


def record_event(src_ip: str, attack_type: str) -> dict | None:
    """Add a new attack event for the given IP, then check if any chain pattern is matched.

    Returns a correlation result dict if a chain was detected, or None if not.
    """
    if attack_type == "BENIGN":
        return None

    now = datetime.utcnow()
    recent_events[src_ip].append((attack_type, now))

    # Prune events that have fallen outside the rolling window.
    cutoff = now - timedelta(minutes=CORRELATION_WINDOW_MINUTES)
    recent_events[src_ip] = [
        (a, t) for a, t in recent_events[src_ip] if t > cutoff
    ]

    return check_for_incident(src_ip)


def check_for_incident(src_ip: str) -> dict | None:
    """Check whether the event sequence for this IP matches any known attack chain."""
    event_sequence = [a for a, t in recent_events[src_ip]]

    for chain in ATTACK_CHAINS:
        if is_subsequence(chain, event_sequence):
            return {
                "src_ip": src_ip,
                "chain": " -> ".join(chain),
                "matched_pattern": chain,
            }
    return None


def is_subsequence(pattern: list[str], sequence: list[str]) -> bool:
    """Return True if every element of pattern appears in sequence in order.

    Uses an iterator over sequence so each element of sequence is consumed at most once,
    preserving the temporal ordering requirement (A before B).
    """
    it = iter(sequence)
    return all(item in it for item in pattern)
