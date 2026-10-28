"""FastAPI dependencies: current user, role guards, DB session."""

from __future__ import annotations

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AuthError, PermissionDeniedError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.enums import Role
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_v1_prefix}/auth/login",
    auto_error=False,
)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the bearer token to a user or raise 401."""
    if not token:
        raise AuthError("Not authenticated. Send an 'Authorization: Bearer <token>' header.")

    payload = decode_access_token(token)
    if not payload:
        raise AuthError("Invalid or expired token.")

    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError):
        raise AuthError("Invalid token subject.") from None

    user = db.get(User, user_id)
    if user is None:
        raise AuthError("Account no longer exists.")
    if not user.is_active:
        raise PermissionDeniedError("This account has been deactivated.")
    return user


def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Like :func:`get_current_user` but returns ``None`` instead of raising."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    try:
        user = db.get(User, int(payload.get("sub", "")))
    except (TypeError, ValueError):
        return None
    return user if user and user.is_active else None


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.ADMIN.value:
        raise PermissionDeniedError("Administrator access required.")
    return user


def require_staff(user: User = Depends(get_current_user)) -> User:
    """Staff *or* admin - used for verification actions."""
    if user.role not in {Role.STAFF.value, Role.ADMIN.value}:
        raise PermissionDeniedError("Staff or administrator access required.")
    return user
