# Application settings — reads every value from the .env file (or environment).
# Never hardcode real secrets here; add them to backend/.env (git-ignored).

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Postgres connection string — must be set in .env before running.
    DATABASE_URL: str = "postgresql://sentinel:sentinel123@localhost:5432/sentinel_ai"

    # JWT signing secret — use a long random string in production.
    JWT_SECRET: str = "change-this-to-a-long-random-string-in-production"
    JWT_ALGORITHM: str = "HS256"

    # Google Gemini API key for the AI Copilot feature.
    # Leave blank during development — the copilot degrades gracefully when absent.
    GEMINI_API_KEY: str = ""

    # Static key the capture agent sends in X-Agent-Key header to authenticate /api/ingest.
    # Must match what is set in capture-agent/.env under the same variable name.
    AGENT_INGEST_KEY: str = "change-this-agent-key"

    # SMTP settings for email alerts (used by services/alert_service.py).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    ALERT_EMAIL_TO: str = ""

    # Telegram bot settings for Telegram alert notifications.
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # Seed admin user credentials
    SEED_ADMIN_USERNAME: str = "admin"
    SEED_ADMIN_PASSWORD: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
