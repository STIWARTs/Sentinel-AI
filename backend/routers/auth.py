# Auth router — handles login and returns a JWT token.
# Registration is intentionally excluded: new users are created via seed_admin.py
# or manually in the DB by an admin, to avoid an open sign-up on the SOC platform.

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from auth.jwt_handler import create_access_token
from database import get_db
from models.user import User
from schemas.auth_schema import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger(__name__)


# curl example:
#   curl -X POST http://localhost:8000/api/auth/login \
#     -H "Content-Type: application/json" \
#     -d '{"username": "admin", "password": "yourpassword"}'
@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a signed JWT access token.

    Input: LoginRequest (username, password).
    Output: TokenResponse (access_token, token_type, role).
    Raises 401 if the username is not found or the password does not match.
    """
    user = db.query(User).filter(User.username == request.username).first()

    if not user or not pwd_context.verify(request.password, user.hashed_password):
        # Return the same error for both "user not found" and "wrong password"
        # so an attacker cannot enumerate valid usernames via the error message.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token({"sub": user.username, "role": user.role})
    logger.info(f"User '{user.username}' logged in successfully")

    return TokenResponse(access_token=token, token_type="bearer", role=user.role)
