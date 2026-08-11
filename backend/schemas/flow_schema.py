"""Pydantic schema for flow logs."""

from pydantic import BaseModel


class FlowSchema(BaseModel):
    source_ip: str
    destination_ip: str
