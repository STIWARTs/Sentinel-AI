# One-time script to create database tables and insert the first admin user.
# Run this once after setting up Postgres and filling in backend/.env.
#
# Usage:
#   cd backend
#   python seed_admin.py
#
# Credentials are read from environment variables (or .env via python-dotenv).
# If SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD are not set, safe printed-warning
# defaults are used so the script still runs during a quick local demo setup.

import os
import sys

from dotenv import load_dotenv

load_dotenv()  # load .env so DATABASE_URL and seed vars are available

from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError

import models  # noqa: F401 — registers all ORM classes with Base.metadata
from database import Base, SessionLocal, engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Read credentials from env; warn loudly if falling back to defaults.
ADMIN_USERNAME = os.environ.get("SEED_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "")


def seed_admin_user() -> None:
    """Create DB tables (if not already present) and insert the first admin user.

    Skips silently if the username already exists so re-running is safe.
    """
    if not ADMIN_PASSWORD:
        print(
            "WARNING: SEED_ADMIN_PASSWORD is not set in environment or .env. "
            "Set it before running in any shared or demo environment."
        )
        print("Aborting seed — refusing to create an admin with an empty password.")
        sys.exit(1)

    # Ensure all tables exist before trying to insert.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        from models.user import User

        existing = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        if existing:
            print(f"Admin user '{ADMIN_USERNAME}' already exists — skipping.")
            return

        hashed = pwd_context.hash(ADMIN_PASSWORD)
        admin = User(username=ADMIN_USERNAME, hashed_password=hashed, role="admin")
        db.add(admin)
        db.commit()
        print(f"Admin user '{ADMIN_USERNAME}' created successfully with role 'admin'.")

    except IntegrityError:
        db.rollback()
        print(f"Admin user '{ADMIN_USERNAME}' already exists (IntegrityError) — skipping.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin_user()
