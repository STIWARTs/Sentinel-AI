"""Sends computed flow features to the backend's /api/ingest endpoint.

The backend authenticates the agent with a static key in the X-Agent-Key
header (it is a machine process, so it does not hold a JWT). That key comes
from AGENT_INGEST_KEY and must be identical to the value in backend/.env.

Two rules this module exists to enforce:

  1. Nothing incomplete or malformed is ever sent. Every payload is validated
     against the agent's own feature list first, and a bad one is logged and
     dropped rather than pushed at the model.
  2. A backend that is down, slow or restarting must not take the agent with
     it. Transport errors and 5xx responses are retried with a short backoff;
     everything else fails once, loudly, and capture keeps running.

The agent key is never written to a log line.
"""

import logging
import time

from features import FEATURE_KEYS, validate_features

logger = logging.getLogger(__name__)

# Guarded so --dry-run and the offline self-test still work on a machine where
# requests has not been installed yet.
try:
    import requests
except ImportError:  # pragma: no cover - exercised only on an incomplete install
    requests = None

DEFAULT_INGEST_URL = "http://localhost:8888/api/ingest"

# Statuses worth trying again: the backend is briefly unavailable or restarting.
_RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}


def build_payload(src_ip: str, features: dict) -> dict:
    """Assemble the JSON body /api/ingest expects: src_ip plus the feature keys.

    Keys stay snake_case; backend/ml/predictor.py::FEATURE_NAME_MAP translates
    them to the CICIDS2017 column names before prediction. Features are written
    in model order so the payload reads the same way as feature_list.json.
    """
    payload = {"src_ip": src_ip}
    for key in FEATURE_KEYS:
        payload[key] = float(features[key])
    return payload


class FlowSender:
    """POSTs one flow at a time to the backend, with validation and retries."""

    def __init__(self, url: str = DEFAULT_INGEST_URL, agent_key: str = "",
                 timeout: float = 5.0, max_retries: int = 2,
                 dry_run: bool = False) -> None:
        self.url = url
        self.timeout = timeout
        self.max_retries = max_retries
        self.dry_run = dry_run
        self._agent_key = agent_key

        # Counters for the shutdown summary.
        self.sent = 0
        self.rejected = 0
        self.failed = 0

        if not dry_run:
            if requests is None:
                raise RuntimeError(
                    "The 'requests' package is required to send to the backend. "
                    "Run: pip install -r requirements.txt (or use --dry-run)."
                )
            if not agent_key:
                raise ValueError(
                    "No agent key. Set AGENT_INGEST_KEY in capture-agent/.env or pass "
                    "--agent-key. It must match AGENT_INGEST_KEY in backend/.env."
                )

    def send(self, src_ip: str, features: dict) -> dict | None:
        """Send one flow. Returns the backend's response body, or None if it did not land."""
        problem = validate_features(features)
        if problem is not None:
            self.rejected += 1
            logger.warning(f"Dropped a flow from {src_ip}: {problem}")
            return None

        payload = build_payload(src_ip, features)

        if self.dry_run:
            self.sent += 1
            logger.info(f"[dry-run] would POST flow from {src_ip}: {_summarize(payload)}")
            return None

        return self._post_with_retries(src_ip, payload)

    def _post_with_retries(self, src_ip: str, payload: dict) -> dict | None:
        last_problem = "unknown error"

        for attempt in range(self.max_retries + 1):
            if attempt:
                # Linear backoff: long enough to let a reloading backend come
                # back, short enough that the agent does not fall behind.
                time.sleep(0.5 * attempt)

            try:
                response = requests.post(
                    self.url,
                    json=payload,
                    headers={"X-Agent-Key": self._agent_key},
                    timeout=self.timeout,
                )
            except requests.RequestException as exc:
                last_problem = f"{type(exc).__name__}: {exc}"
                logger.debug(f"POST attempt {attempt + 1} failed: {last_problem}")
                continue

            if response.status_code == 200:
                self.sent += 1
                return _log_result(src_ip, response)

            if response.status_code in (401, 403):
                # Retrying cannot fix a wrong key, so say so once and clearly.
                self.failed += 1
                logger.error(
                    f"Backend rejected the agent key ({response.status_code}). "
                    f"AGENT_INGEST_KEY in capture-agent/.env must match backend/.env."
                )
                return None

            if response.status_code == 422:
                # The backend validated the payload and refused it - a feature
                # sync problem, not a transport problem, so do not retry.
                self.failed += 1
                logger.error(
                    f"Backend rejected the payload (422): {_safe_detail(response)}. "
                    f"Check AGENT_TO_MODEL in features.py against "
                    f"FEATURE_NAME_MAP in backend/ml/predictor.py."
                )
                return None

            last_problem = f"HTTP {response.status_code}"
            if response.status_code not in _RETRYABLE_STATUS:
                break

        self.failed += 1
        logger.error(f"Gave up sending the flow from {src_ip} to {self.url}: {last_problem}")
        return None


def _log_result(src_ip: str, response) -> dict | None:
    """Log the prediction the backend came back with, tolerating an odd body."""
    try:
        result = response.json()
    except ValueError:
        logger.warning(f"Backend returned 200 with a non-JSON body for {src_ip}")
        return None

    logger.info(
        f"{src_ip} -> {result.get('prediction')} "
        f"(confidence={result.get('confidence', 0):.2f}, "
        f"risk={result.get('risk_score')}, severity={result.get('severity')})"
    )
    return result


def _safe_detail(response) -> str:
    """Pull FastAPI's error detail out of a response without ever raising."""
    try:
        return str(response.json().get("detail", response.text))[:400]
    except ValueError:
        return response.text[:400]


def _summarize(payload: dict) -> str:
    """A short, readable line for --dry-run. Metadata only, no full feature dump."""
    return (
        f"packets={payload['total_fwd_packets'] + payload['total_bwd_packets']:.0f} "
        f"bytes={payload['total_length_fwd_packets'] + payload['total_length_bwd_packets']:.0f} "
        f"duration_us={payload['flow_duration']:.0f} "
        f"syn={payload['syn_flag_count']:.0f} ack={payload['ack_flag_count']:.0f}"
    )
