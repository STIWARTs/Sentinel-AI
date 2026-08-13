# Dataset replay script — demo fallback that acts as a stand-in for the live
# capture agent. It reads recorded CICIDS2017 flows from a CSV and POSTs them
# to the backend's /api/ingest endpoint exactly like the real agent would,
# so the full pipeline (prediction, risk scoring, incidents, dashboard) can be
# demonstrated even when live packet capture is unavailable.

import argparse
import json
import logging
import os
import time

import pandas as pd
import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Load capture-agent/.env so the agent key can live there instead of on the command line.
load_dotenv()

# feature_list.json sits next to this script and defines the exact 20 columns
# the trained model expects — replay sends only these, keeping Feature Sync intact.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_FEATURE_LIST_PATH = os.path.join(_SCRIPT_DIR, "feature_list.json")

_DEFAULT_CSV = os.path.join(
    _SCRIPT_DIR, "..", "ml-pipeline", "data", "cicids2017", "Monday-WorkingHours.pcap_ISCX.csv"
)


def load_feature_names() -> list[str]:
    """Read the shared feature list so the replayed columns match the model exactly."""
    with open(_FEATURE_LIST_PATH) as f:
        return json.load(f)


def load_flows(csv_path: str, feature_names: list[str]) -> pd.DataFrame:
    """Load the CICIDS2017 CSV and keep only the model's feature columns plus labels.

    Handles two known dataset quirks (same as the training notebook):
    - column names carry stray whitespace, so every name is stripped;
    - rate columns contain Infinity from divide-by-zero during the original
      extraction, converted here to NaN and then 0 so predictions stay valid.
    """
    df = pd.read_csv(csv_path)
    df.columns = [str(col).strip() for col in df.columns]

    missing = [name for name in feature_names if name not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing expected feature columns: {missing}")

    # Keep the label column (if present) only for logging — it is never sent to the backend.
    keep = feature_names + (["Label"] if "Label" in df.columns else [])
    flows = df[keep].copy()

    flows = flows.replace([float("inf"), float("-inf")], float("nan")).fillna(0.0)
    return flows


def sample_flows(flows: pd.DataFrame, limit: int, mix_classes: bool) -> pd.DataFrame:
    """Pick which rows to replay.

    With mix_classes enabled and a Label column present, take roughly equal
    numbers from each attack/benign class so the demo shows both normal and
    malicious predictions instead of the dataset's heavily benign skew.
    """
    if mix_classes and "Label" in flows.columns and len(flows) > limit:
        per_class = max(1, limit // flows["Label"].nunique())
        return flows.groupby("Label", group_keys=False).head(per_class)
    return flows.head(limit)


def build_payload(row: pd.Series, feature_names: list[str]) -> dict:
    """Convert one dataset row into the JSON body /api/ingest expects.

    Column names are already the CICIDS2017 model names, which the predictor's
    normalize_features() passes through unchanged. The CICIDS CSVs carry no
    source IP column, so a placeholder is used.
    """
    payload = {"src_ip": "192.168.1.100"}
    for name in feature_names:
        payload[name] = float(row[name])
    return payload


def replay(csv_path: str, url: str, agent_key: str, limit: int,
           delay_seconds: float, mix_classes: bool) -> None:
    """Main loop — load flows, then POST them one at a time to the backend."""
    feature_names = load_feature_names()
    flows = sample_flows(load_flows(csv_path, feature_names), limit, mix_classes)

    logger.info(f"Replaying {len(flows)} flow(s) from {os.path.basename(csv_path)} to {url}")

    # Network calls to the backend can fail transiently, so each POST is wrapped
    # rather than aborting the whole replay on one dropped request.
    for index, (_, row) in enumerate(flows.iterrows(), start=1):
        payload = build_payload(row, feature_names)
        true_label = row.get("Label", "unknown")
        try:
            response = requests.post(
                url,
                json=payload,
                headers={"X-Agent-Key": agent_key},
                timeout=10,
            )
            response.raise_for_status()
            result = response.json()
            logger.info(
                f"[{index}/{len(flows)}] true={true_label} -> "
                f"predicted={result['prediction']} "
                f"(confidence={result['confidence']:.2f}, risk={result['risk_score']})"
            )
        except requests.RequestException as exc:
            logger.error(f"[{index}/{len(flows)}] POST failed: {exc}")

        # Small pause between flows so the live dashboard feed updates visibly.
        if delay_seconds > 0 and index < len(flows):
            time.sleep(delay_seconds)

    logger.info("Replay finished.")


def main() -> None:
    """Parse command-line arguments and start the replay."""
    parser = argparse.ArgumentParser(
        description="Replay CICIDS2017 flows into the backend /api/ingest endpoint."
    )
    parser.add_argument("--csv", default=_DEFAULT_CSV, help="Path to a CICIDS2017 CSV file")
    parser.add_argument("--url", default="http://localhost:8888/api/ingest",
                        help="Backend ingest endpoint URL")
    parser.add_argument("--agent-key", default=os.getenv("AGENT_INGEST_KEY", ""),
                        help="X-Agent-Key value; falls back to AGENT_INGEST_KEY in .env")
    parser.add_argument("--rows", type=int, default=20, help="How many flows to replay")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="Seconds to wait between flows (0 for instant)")
    parser.add_argument("--mix", action="store_true",
                        help="Sample roughly equal rows per class (benign + attacks)")
    args = parser.parse_args()

    if not args.agent_key:
        parser.error("No agent key given. Pass --agent-key or set AGENT_INGEST_KEY in capture-agent/.env")

    replay(args.csv, args.url, args.agent_key, args.rows, args.delay, args.mix)


if __name__ == "__main__":
    main()
