# Pydantic schemas for the auth endpoints.

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class CopilotAskRequest(BaseModel):
    question: str
    incident_context: dict  # caller passes the incident fields they want the Copilot to reason about


class CopilotAskResponse(BaseModel):
    answer: str
