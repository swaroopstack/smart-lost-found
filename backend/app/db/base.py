"""Declarative base, shared mixins and UTC time helpers."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

#: All datetimes in this project are stored as *naive UTC* so that SQLite and
#: PostgreSQL behave identically. Use :func:`utcnow` when writing values.
DATETIME_TYPE = DateTime


def utcnow() -> datetime:
    """Current UTC time as a naive datetime (what the DB stores)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_naive_utc(value: datetime | None) -> datetime | None:
    """Normalise an incoming datetime to naive UTC.

    Naive values are assumed to already be UTC (the API contract says so).
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    """Adds ``created_at`` / ``updated_at`` columns (naive UTC)."""

    created_at: Mapped[datetime] = mapped_column(
        DATETIME_TYPE, default=utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DATETIME_TYPE, default=utcnow, onupdate=utcnow, nullable=False
    )
