"""Notification schemas."""

from typing import Any

from pydantic import Field

from app.schemas.common import ORMModel, UTCDateTime


class NotificationOut(ORMModel):
    id: int
    type: str
    title: str
    body: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    is_read: bool
    created_at: UTCDateTime


class UnreadCount(ORMModel):
    unread: int
