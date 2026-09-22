# Pydantic schemas for the /api/ingest endpoint.
# FlowIngestRequest accepts src_ip plus any number of feature fields from the capture agent.
# FlowIngestResponse is what the endpoint returns after prediction.

import math

from pydantic import BaseModel, ConfigDict, IPvAnyAddress, model_validator


class FlowIngestRequest(BaseModel):
    src_ip: IPvAnyAddress

    # extra="allow" lets the agent POST any feature key alongside src_ip without
    # needing a fixed field list in the schema — the predictor handles feature validation.
    model_config = ConfigDict(extra="allow")

    @model_validator(mode="after")
    def validate_feature_values(self):
        """Reject malformed feature values before they reach pandas or the model."""
        for key, value in (self.model_extra or {}).items():
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"Feature '{key}' must be a number")
            if not math.isfinite(value):
                raise ValueError(f"Feature '{key}' must be finite")
            if value < 0:
                raise ValueError(f"Feature '{key}' cannot be negative")
        return self


class FlowIngestResponse(BaseModel):
    status: str
    prediction: str
    confidence: float
    risk_score: int
    severity: str
