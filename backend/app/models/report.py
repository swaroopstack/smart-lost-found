"""Lost / found item reports - the central entity of the system."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin
from app.models.enums import ReportStatus, ReportType


class ItemReport(Base, TimestampMixin):
    __tablename__ = "item_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String(10), nullable=False, index=True)

    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    #: Free text visible to everybody.
    public_description: Mapped[str | None] = mapped_column(Text)
    #: Secret detail used for verification + as a strong matching signal.
    #: NEVER serialise this field to a client.
    hidden_detail: Mapped[str | None] = mapped_column(Text)

    #: Structured per-category attributes, e.g. ``{"colour": "black", ...}``
    attributes: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), index=True)
    #: When the item was lost (LOST) or found (FOUND). Naive UTC.
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    status: Mapped[str] = mapped_column(
        String(20), default=ReportStatus.OPEN.value, nullable=False, index=True
    )
    #: FOUND reports only - where the finder handed the item in.
    deposited_location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"))

    photo_path: Mapped[str | None] = mapped_column(String(255))
    #: Perceptual hash (16 hex chars = 64 bits) computed on upload.
    photo_hash: Mapped[str | None] = mapped_column(String(32))

    closed_at: Mapped[datetime | None] = mapped_column(DateTime)
    #: Admin note shown to the owner when a report is closed/rejected.
    admin_note: Mapped[str | None] = mapped_column(Text)

    reporter: Mapped["User"] = relationship(foreign_keys=[reporter_id])  # noqa: F821
    category: Mapped["Category"] = relationship()  # noqa: F821
    location: Mapped["Location | None"] = relationship(foreign_keys=[location_id])  # noqa: F821
    deposited_location: Mapped["Location | None"] = relationship(  # noqa: F821
        foreign_keys=[deposited_location_id]
    )

    @property
    def is_lost(self) -> bool:
        return self.type == ReportType.LOST.value

    @property
    def is_found(self) -> bool:
        return self.type == ReportType.FOUND.value

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ItemReport id={self.id} type={self.type} status={self.status}>"
