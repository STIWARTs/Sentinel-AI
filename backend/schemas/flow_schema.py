# Pydantic schemas for the /api/ingest endpoint.
# FlowIngestRequest accepts src_ip plus any number of feature fields from the capture agent.
# FlowIngestResponse is what the endpoint returns after prediction.

from pydantic import BaseModel, ConfigDict


class FlowIngestRequest(BaseModel):
    src_ip: str

    # extra="allow" lets the agent POST any feature key alongside src_ip without
    # needing a fixed field list in the schema — the predictor handles feature validation.
    model_config = ConfigDict(extra="allow")


class FlowIngestResponse(BaseModel):
    status: str
    prediction: str
    confidence: float
    risk_score: int
    severity: str
