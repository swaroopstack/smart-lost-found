"""Ownership claim: a student proving that a found item is theirs."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin
from app.models.enums import ClaimStatus


class Claim(Base, TimestampMixin):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"), index=True, nullable=False
    )
    claimant_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Answers to the verification questions, e.g.
    #: ``{"hidden_detail": "red dragon sticker", "custom": [...]}``
    answers: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), default=ClaimStatus.PENDING.value, nullable=False, index=True
    )
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text)

    match: Mapped["Match"] = relationship(lazy="joined")  # noqa: F821
    claimant: Mapped["User"] = relationship(foreign_keys=[claimant_id])  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Claim id={self.id} status={self.status}>"
