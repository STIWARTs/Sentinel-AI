# ML prediction module — loads the trained model artifacts once at startup and
# exposes a predict() function used by the ingest router.
#
# Feature name translation: the capture agent sends snake_case keys while the model
# was trained on CICIDS2017 column names (e.g. "Flow Packets/s"). FEATURE_NAME_MAP
# bridges the two naming conventions.

import json
import logging
import os

import joblib
import pandas as pd

logger = logging.getLogger(__name__)

# Resolve paths relative to this file's location so imports work regardless of
# the working directory uvicorn is launched from.
_ML_DIR = os.path.dirname(os.path.abspath(__file__))


def _load(filename: str):
    """Load a file from the ml/ directory, raising a clear error if missing."""
    path = os.path.join(_ML_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Required ML artifact not found: {path}. "
            f"Copy it from ml-pipeline/notebooks/output/ into backend/ml/."
        )
    return path


# Load all artifacts at module import time so the first request is not slow.
_model = joblib.load(_load("model.pkl"))
_scaler = joblib.load(_load("scaler.pkl"))

with open(_load("feature_list.json")) as f:
    FEATURE_ORDER: list[str] = json.load(f)

with open(_load("label_mapping.json")) as f:
    # Keys are strings ("0"–"4") because JSON only supports string keys.
    # The model returns integer class labels, so we cast before lookup.
    _LABEL_MAPPING: dict[str, str] = json.load(f)


# PROVISIONAL: these mappings translate the capture agent's snake_case feature keys
# to the CICIDS2017 column names the model was trained on.
# Re-verify against capture-agent/features.py once your teammate finalises that file.
# If a key changes on either side, update this dict AND re-run the Feature Sync Checklist.
FEATURE_NAME_MAP: dict[str, str] = {
    # agent key                  : CICIDS2017 model key
    "flow_duration":              "Flow Duration",
    "total_fwd_packets":          "Total Fwd Packets",
    "total_bwd_packets":          "Total Backward Packets",
    "total_length_fwd_packets":   "Total Length of Fwd Packets",
    "total_length_bwd_packets":   "Total Length of Bwd Packets",
    "flow_bytes_per_second":      "Flow Bytes/s",
    "flow_packets_per_second":    "Flow Packets/s",
    "flow_iat_mean":              "Flow IAT Mean",
    "flow_iat_std":               "Flow IAT Std",
    "flow_iat_max":               "Flow IAT Max",
    "flow_iat_min":               "Flow IAT Min",
    "syn_flag_count":             "SYN Flag Count",
    "ack_flag_count":             "ACK Flag Count",
    "rst_flag_count":             "RST Flag Count",
    "fin_flag_count":             "FIN Flag Count",
    "psh_flag_count":             "PSH Flag Count",
    "packet_length_mean":         "Packet Length Mean",
    "packet_length_std":          "Packet Length Std",
    "min_packet_length":          "Min Packet Length",
    "max_packet_length":          "Max Packet Length",
}


def normalize_features(raw: dict) -> dict:
    """Translate agent-side feature keys to the CICIDS2017 names the model expects.

    If the incoming dict already uses CICIDS2017 names (e.g. during direct testing),
    those pass through unchanged. Keys present in raw but absent from FEATURE_NAME_MAP
    are left as-is; the subsequent column selection in predict() will surface any gaps.
    """
    normalized: dict = {}
    for key, value in raw.items():
        # Use the translated name if this key is a known agent alias; otherwise keep it.
        model_key = FEATURE_NAME_MAP.get(key, key)
        normalized[model_key] = value
    return normalized


def predict(features: dict) -> tuple[str, float]:
    """Run one prediction and return (class_name, confidence).

    Steps:
      1. Translate feature key names from agent format to model format.
      2. Build a single-row DataFrame in the exact column order the model expects.
      3. Scale using the fitted StandardScaler.
      4. Predict with the Random Forest / XGBoost model.
      5. Convert numeric class label to a readable string via label_mapping.json.

    Raises ValueError if a required feature column is still missing after translation.
    """
    translated = normalize_features(features)

    # Check that every required feature is present before building the DataFrame.
    missing = [col for col in FEATURE_ORDER if col not in translated]
    if missing:
        raise ValueError(
            f"Incoming feature dict is missing {len(missing)} required feature(s) "
            f"after name translation: {missing}. "
            f"Update FEATURE_NAME_MAP in ml/predictor.py to cover these names."
        )

    row = pd.DataFrame([translated])[FEATURE_ORDER]
    scaled = _scaler.transform(row)

    numeric_label: int = _model.predict(scaled)[0]
    confidence: float = float(_model.predict_proba(scaled).max())

    # The model outputs integer class labels (0-4); convert to the readable string name.
    class_name: str = _LABEL_MAPPING.get(str(numeric_label), f"UNKNOWN_{numeric_label}")

    return class_name, confidence
