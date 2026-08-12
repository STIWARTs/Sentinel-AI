# User ORM model — stores analyst/admin accounts for dashboard login.
# Passwords are stored as bcrypt hashes; the plaintext is never persisted.

from sqlalchemy import Column, Integer, String

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="viewer")   # admin / analyst / viewer
