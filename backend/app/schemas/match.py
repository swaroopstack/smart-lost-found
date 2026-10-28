"""Match schemas."""

from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import MatchBand, MatchStatus
from app.schemas.common import UTCDateTime
from app.schemas.report import ReportPublic


class MatchOut(BaseModel):
    """A scored LOST/FOUND pairing.

    Students only ever receive ``score`` and ``band``; the full
    ``score_breakdown`` is reserved for admins (see :class:`MatchDetail`).
    """

    id: int
    score: int
    band: MatchBand
    status: MatchStatus
    lost_report: ReportPublic
    found_report: ReportPublic
    created_at: UTCDateTime
    reviewed_at: UTCDateTime | None = None


class MatchDetail(MatchOut):
    score_breakdown: dict[str, Any] = Field(default_factory=dict)
    review_note: str | None = None
    reviewed_by: int | None = None


class MatchReviewIn(BaseModel):
    note: str | None = Field(default=None, max_length=255)
