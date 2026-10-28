"""Shared schema primitives: UTC datetime type, pagination envelope, errors."""

from datetime import datetime, timezone
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, PlainSerializer


def _serialize_utc(value: datetime) -> str:
    """Always emit an explicit UTC ISO-8601 string, e.g. ``2026-10-27T09:15:00Z``."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


#: Use this instead of ``datetime`` in every response schema.
UTCDateTime = Annotated[
    datetime, PlainSerializer(_serialize_utc, return_type=str, when_used="json")
]


class ORMModel(BaseModel):
    """Base for schemas built from SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Standard paginated envelope used by every list endpoint."""

    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class Message(BaseModel):
    message: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: dict[str, str] | None = None


class ErrorResponse(BaseModel):
    detail: ErrorDetail
