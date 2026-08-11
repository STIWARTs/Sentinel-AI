"""Pydantic schema for incidents."""

from pydantic import BaseModel


class IncidentSchema(BaseModel):
    title: str
    severity: str
