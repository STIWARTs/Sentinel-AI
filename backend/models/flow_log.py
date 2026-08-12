# FlowLog ORM model — one row per prediction received from the capture agent.
# Used for the live feed, dashboard charts, and historical queries.

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from database import Base


class FlowLog(Base):
    __tablename__ = "flow_logs"

    id = Column(Integer, primary_key=True, index=True)
    src_ip = Column(String, index=True)
    prediction = Column(String, index=True)   # BENIGN, DDoS, PortScan, BruteForce, Bot
    confidence = Column(Float)                # model's max class probability (0.0–1.0)
    risk_score = Column(Integer)              # 0–100, computed by risk_scoring.py
    timestamp = Column(DateTime, default=datetime.utcnow)
