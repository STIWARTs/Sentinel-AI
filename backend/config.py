"""Application settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Sentinel AI"
    database_url: str = "postgresql+psycopg2://sentinel:sentinel@localhost:5432/sentinel_ai"
    redis_url: str = "redis://localhost:6379/0"


settings = Settings()
