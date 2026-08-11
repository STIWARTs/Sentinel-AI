"""Flow log ORM model."""

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class FlowLog(Base):
    __tablename__ = "flow_logs"

    id = Column(Integer, primary_key=True, index=True)
    source_ip = Column(String(64), nullable=False)
    destination_ip = Column(String(64), nullable=False)
