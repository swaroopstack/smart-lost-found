"""In-app notification endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.errors import NotFoundError
from app.core.pagination import PageParams, build_page, page_params, paginate
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import Message
from app.schemas.notification import NotificationOut, UnreadCount

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=dict, summary="My notifications")
def list_notifications(
    unread_only: bool = Query(default=False),
    params: PageParams = Depends(page_params),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    stmt = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))

    rows, total = paginate(db, stmt, params)
    items = [NotificationOut.model_validate(row) for row in rows]
    return build_page(items, total, params)


@router.get("/unread-count", response_model=UnreadCount, summary="Unread badge count")
def unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UnreadCount:
    count = db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id, Notification.is_read.is_(False)
        )
    ).scalar_one()
    return UnreadCount(unread=count)


@router.post("/{notification_id}/read", response_model=Message, summary="Mark one as read")
def mark_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != user.id:
        raise NotFoundError(f"Notification {notification_id} does not exist.")
    notification.is_read = True
    db.commit()
    return Message(message="Marked as read.")


@router.post("/read-all", response_model=Message, summary="Mark all as read")
def mark_all_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return Message(message="All notifications marked as read.")
