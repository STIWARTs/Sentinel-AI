# FastAPI auth dependencies — JWT extraction and role-based access control.
# Import get_current_user or require_role() as a Depends() argument in any router.

import logging

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from auth.jwt_handler import decode_token

logger = logging.getLogger(__name__)

# HTTPBearer extracts the token from "Authorization: Bearer <token>" automatically.
bearer_scheme = HTTPBearer()

# Numeric rank per role so a higher-privileged role satisfies any lower requirement.
ROLE_RANK: dict[str, int] = {
    "viewer": 1,
    "analyst": 2,
    "admin": 3,
}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """FastAPI dependency that decodes the JWT and returns the token payload.

    Raises 401 if the token is missing, malformed, or expired.
    The returned dict contains at minimum {"sub": username, "role": role}.
    """
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("sub") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload is missing the user identity claim",
            )
        return payload
    except JWTError as exc:
        logger.warning(f"JWT validation failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


def require_role(minimum_role: str):
    """Return a FastAPI dependency that enforces a minimum role level.

    Usage in a router:
        @router.patch("...", dependencies=[Depends(require_role("analyst"))])

    Admin satisfies analyst and viewer requirements; analyst satisfies viewer.
    """

    def _check_role(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role", "viewer")
        user_rank = ROLE_RANK.get(user_role, 0)
        required_rank = ROLE_RANK.get(minimum_role, 0)

        if user_rank < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires the '{minimum_role}' role or higher",
            )
        return user

    return _check_role
