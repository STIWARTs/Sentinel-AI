# Database engine, session factory, and shared declarative base.
# All SQLAlchemy models must import Base from here so create_all() sees every table.

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Single Base shared across all model files — importing Base locally in each model
# would create separate metadata registries and cause create_all() to miss tables.
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
