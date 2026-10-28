"""In-app notification helpers."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User
from app.models.enums import Role


def notify(
    db: Session,
    *,
    user_id: int,
    type: str,
    title: str,
    body: str | None = None,
    payload: dict | None = None,
) -> Notification:
    """Create a notification row (does not commit)."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title[:140],
        body=(body or "")[:500] or None,
        payload=payload or {},
    )
    db.add(notification)
    return notification


def notify_admins(
    db: Session,
    *,
    type: str,
    title: str,
    body: str | None = None,
    payload: dict | None = None,
) -> list[Notification]:
    """Broadcast a notification to every admin account."""
    admin_ids = db.execute(
        select(User.id).where(User.role == Role.ADMIN.value, User.is_active.is_(True))
    ).scalars().all()
    return [
        notify(db, user_id=admin_id, type=type, title=title, body=body, payload=payload)
        for admin_id in admin_ids
    ]
