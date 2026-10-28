"""A scored pairing between one LOST report and one FOUND report."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin
from app.models.enums import MatchStatus


class Match(Base, TimestampMixin):
    __tablename__ = "matches"
    __table_args__ = (
        UniqueConstraint("lost_report_id", "found_report_id", name="uq_matches_pair"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    lost_report_id: Mapped[int] = mapped_column(
        ForeignKey("item_reports.id", ondelete="CASCADE"), index=True, nullable=False
    )
    found_report_id: Mapped[int] = mapped_column(
        ForeignKey("item_reports.id", ondelete="CASCADE"), index=True, nullable=False
    )

    #: 0-100 integer confidence.
    score: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    #: Full per-signal explanation, see ``app.services.matching.scoring``.
    score_breakdown: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    band: Mapped[str] = mapped_column(String(10), nullable=False, index=True)

    status: Mapped[str] = mapped_column(
        String(20), default=MatchStatus.SUGGESTED.value, nullable=False, index=True
    )
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    review_note: Mapped[str | None] = mapped_column(String(255))

    lost_report: Mapped["ItemReport"] = relationship(  # noqa: F821
        foreign_keys=[lost_report_id], lazy="joined"
    )
    found_report: Mapped["ItemReport"] = relationship(  # noqa: F821
        foreign_keys=[found_report_id], lazy="joined"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Match id={self.id} score={self.score} status={self.status}>"
