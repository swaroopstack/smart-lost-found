"""Admin dashboard schemas."""

from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import MatchBand, MatchStatus, ReportStatus, ReportType
from app.schemas.common import ORMModel, UTCDateTime
from app.schemas.report import ReportPublic


class StatsToday(BaseModel):
    """Powers the numbers row on the admin dashboard (deck slide 9)."""

    date: str
    lost_reports: int
    found_reports: int
    possible_matches: int
    items_returned: int
    pending_claims: int
    open_reports: int


class VerificationQueueItem(BaseModel):
    match_id: int
    score: int
    band: MatchBand
    status: MatchStatus
    lost_report: ReportPublic
    found_report: ReportPublic
    created_at: UTCDateTime


class AuditLogOut(ORMModel):
    id: int
    actor_id: int | None = None
    action: str
    entity: str | None = None
    entity_id: int | None = None
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: UTCDateTime


class StatusCount(BaseModel):
    status: ReportStatus
    count: int


class CategoryCount(BaseModel):
    category: str
    type: ReportType
    count: int
