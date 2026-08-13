# JWT utility functions — token creation and decoding.
# Uses python-jose for HS256 signing. Secret and algorithm come from config.py.

from datetime import datetime, timedelta

from jose import JWTError, jwt

from config import settings

# Access tokens expire after 8 hours — long enough for a working day without frequent re-login.
ACCESS_TOKEN_EXPIRE_HOURS = 8


def create_access_token(data: dict) -> str:
    """Encode a JWT containing the given payload plus an expiry claim."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises JWTError if the token is invalid or expired."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
