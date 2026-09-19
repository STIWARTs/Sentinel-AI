"""Feature extraction — turns a finished Flow into the exact 20 values the model wants.

THE GOLDEN RULE (doc/Project Status.md, section 4): the feature set must stay
identical in three places -

    1. ml-pipeline/notebooks/output/feature_list.json   (training)
    2. capture-agent/feature_list.json                  (this agent)
    3. backend/ml/feature_list.json                     (inference)

verify_feature_sync() enforces that at start-up, so a drift fails loudly with a
readable message instead of quietly producing wrong predictions.

NAMING
    The agent works in snake_case and POSTs snake_case keys to /api/ingest.
    backend/ml/predictor.py::FEATURE_NAME_MAP translates them into the
    CICIDS2017 column names the model was trained on. AGENT_TO_MODEL below is
    the agent-side copy of that same mapping, written in the model's column
    order, and it is what verify_feature_sync() checks against
    feature_list.json. If a key ever changes, it must change in both files.

UNITS AND CONVENTIONS (these are what CICFlowMeter used to build CICIDS2017,
so they are what the model's learned thresholds actually mean)
    Flow Duration, Flow IAT *      microseconds
    Flow Bytes/s, Flow Packets/s   per second
    packet length                  transport payload bytes, headers excluded
    standard deviation             sample (n-1) deviation
    flag counts                    per flow, counting both directions
"""

import json
import logging
import math
import os

logger = logging.getLogger(__name__)

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_FEATURE_LIST_PATH = os.path.join(_SCRIPT_DIR, "feature_list.json")

# A flow needs at least this many packets before its features mean anything:
# with a single packet there is no inter-arrival time and no duration, which is
# exactly the case CICFlowMeter recorded as Infinity and the training notebook
# then dropped. Sending one would be feeding the model an input shape it has
# never seen.
MIN_PACKETS_PER_FLOW = 2

# agent key -> CICIDS2017 model column, in the model's own column order.
# Must stay identical to FEATURE_NAME_MAP in backend/ml/predictor.py.
AGENT_TO_MODEL: dict[str, str] = {
    "flow_duration":            "Flow Duration",
    "total_fwd_packets":        "Total Fwd Packets",
    "total_bwd_packets":        "Total Backward Packets",
    "total_length_fwd_packets": "Total Length of Fwd Packets",
    "total_length_bwd_packets": "Total Length of Bwd Packets",
    "flow_bytes_per_second":    "Flow Bytes/s",
    "flow_packets_per_second":  "Flow Packets/s",
    "flow_iat_mean":            "Flow IAT Mean",
    "flow_iat_std":             "Flow IAT Std",
    "flow_iat_max":             "Flow IAT Max",
    "flow_iat_min":             "Flow IAT Min",
    "syn_flag_count":           "SYN Flag Count",
    "ack_flag_count":           "ACK Flag Count",
    "rst_flag_count":           "RST Flag Count",
    "fin_flag_count":           "FIN Flag Count",
    "psh_flag_count":           "PSH Flag Count",
    "packet_length_mean":       "Packet Length Mean",
    "packet_length_std":        "Packet Length Std",
    "min_packet_length":        "Min Packet Length",
    "max_packet_length":        "Max Packet Length",
}

# The agent-side feature keys, in model order.
FEATURE_KEYS: list[str] = list(AGENT_TO_MODEL)


class FeatureSyncError(RuntimeError):
    """Raised when the agent's feature set no longer matches feature_list.json."""


def load_model_feature_names() -> list[str]:
    """Read the shared feature_list.json that training and the backend also use."""
    with open(_FEATURE_LIST_PATH) as handle:
        return json.load(handle)


def verify_feature_sync() -> list[str]:
    """Check the agent's feature mapping against feature_list.json.

    Returns the model feature names on success. Raises FeatureSyncError with a
    specific description of the drift otherwise, so the agent refuses to start
    rather than sending data the model cannot interpret.
    """
    try:
        model_features = load_model_feature_names()
    except FileNotFoundError as exc:
        raise FeatureSyncError(
            f"feature_list.json not found at {_FEATURE_LIST_PATH}. "
            f"Copy it from ml-pipeline/notebooks/output/."
        ) from exc
    except json.JSONDecodeError as exc:
        raise FeatureSyncError(f"feature_list.json is not valid JSON: {exc}") from exc

    mapped = list(AGENT_TO_MODEL.values())

    if mapped != model_features:
        missing = [name for name in model_features if name not in mapped]
        extra = [name for name in mapped if name not in model_features]
        if missing or extra:
            raise FeatureSyncError(
                f"Feature set drift between AGENT_TO_MODEL in features.py and "
                f"feature_list.json. Missing from the agent: {missing}. "
                f"Present in the agent but not in the model: {extra}."
            )
        raise FeatureSyncError(
            f"The agent and the model use the same {len(mapped)} features but in a "
            f"different order.\n  agent: {mapped}\n  model: {model_features}"
        )

    logger.info(f"Feature sync verified: {len(model_features)} features match feature_list.json")
    return model_features


def compute_flow_features(flow) -> dict[str, float]:
    """Compute the 20 model features for one finished flow.

    Returns a dict keyed by the agent's snake_case names, in model order. The
    caller is responsible for checking validate_features() before sending.
    """
    # CICIDS2017 records duration in microseconds.
    duration_us = max(flow.duration_seconds, 0.0) * 1_000_000.0
    if duration_us <= 0.0:
        # Two packets can share one capture timestamp on a coarse clock. Dividing
        # by zero is what produced the Infinity values in the raw dataset, which
        # training then dropped, so clamp to the smallest duration a microsecond
        # timestamp can express instead of emitting a value the model never saw.
        duration_us = 1.0
    duration_seconds = duration_us / 1_000_000.0

    total_packets = flow.packet_count
    total_payload_bytes = flow.fwd_payload_bytes + flow.bwd_payload_bytes

    lengths = flow.packet_lengths
    inter_arrival = flow.inter_arrival_times

    return {
        "flow_duration":            duration_us,
        "total_fwd_packets":        float(flow.fwd_packets),
        "total_bwd_packets":        float(flow.bwd_packets),
        "total_length_fwd_packets": float(flow.fwd_payload_bytes),
        "total_length_bwd_packets": float(flow.bwd_payload_bytes),
        "flow_bytes_per_second":    total_payload_bytes / duration_seconds,
        "flow_packets_per_second":  total_packets / duration_seconds,
        "flow_iat_mean":            inter_arrival.mean,
        "flow_iat_std":             inter_arrival.std,
        "flow_iat_max":             inter_arrival.maximum,
        "flow_iat_min":             inter_arrival.minimum,
        "syn_flag_count":           float(flow.flag_counts["SYN"]),
        "ack_flag_count":           float(flow.flag_counts["ACK"]),
        "rst_flag_count":           float(flow.flag_counts["RST"]),
        "fin_flag_count":           float(flow.flag_counts["FIN"]),
        "psh_flag_count":           float(flow.flag_counts["PSH"]),
        "packet_length_mean":       lengths.mean,
        "packet_length_std":        lengths.std,
        "min_packet_length":        lengths.minimum,
        "max_packet_length":        lengths.maximum,
    }


def is_reportable(flow, min_packets: int = MIN_PACKETS_PER_FLOW) -> bool:
    """True if this flow carries enough packets for its features to be meaningful."""
    return flow.packet_count >= min_packets


def validate_features(features: dict) -> str | None:
    """Return a description of the first problem found, or None if the dict is sound.

    This is the last gate before anything leaves the agent. The backend rejects
    a malformed record with a 422 anyway, but catching it here means the reason
    is logged next to the flow that caused it.
    """
    missing = [key for key in FEATURE_KEYS if key not in features]
    if missing:
        return f"missing {len(missing)} feature(s): {missing}"

    unexpected = [key for key in features if key not in AGENT_TO_MODEL]
    if unexpected:
        return f"unexpected feature key(s): {unexpected}"

    for key in FEATURE_KEYS:
        value = features[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return f"{key} is {type(value).__name__}, expected a number"
        if not math.isfinite(value):
            return f"{key} is {value}, which the model cannot consume"
        if value < 0:
            return f"{key} is negative ({value})"

    return None
