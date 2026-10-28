"""Admin match-review endpoints (verification queue)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.core.errors import ConflictError, NotFoundError
from app.core.pagination import PageParams, build_page, page_params, paginate
from app.db.base import utcnow
from app.db.session import get_db
from app.models.catalog import Category
from app.models.enums import MatchStatus, NotificationType, ReportStatus
from app.models.match import Match
from app.models.report import ItemReport
from app.models.user import User
from app.schemas.match import MatchDetail, MatchReviewIn
from app.services import audit, serializers
from app.services import notifications as notification_service

router = APIRouter(prefix="/admin/matches", tags=["Admin: Matches"])


def _get_match_or_404(db: Session, match_id: int) -> Match:
    match = db.get(Match, match_id)
    if match is None:
        raise NotFoundError(f"Match {match_id} does not exist.")
    return match


@router.get("", response_model=dict, summary="List matches (verification queue)")
def list_matches(
    status_filter: MatchStatus | None = Query(default=None, alias="status"),
    band: str | None = Query(default=None, pattern="^(HIGH|MEDIUM)$"),
    min_score: int = Query(default=0, ge=0, le=100),
    params: PageParams = Depends(page_params),
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(Match).order_by(Match.score.desc(), Match.created_at.desc())
    if status_filter:
        stmt = stmt.where(Match.status == status_filter.value)
    if band:
        stmt = stmt.where(Match.band == band)
    if min_score:
        stmt = stmt.where(Match.score >= min_score)

    rows, total = paginate(db, stmt, params)
    items = [serializers.match_detail(match, admin) for match in rows]
    return build_page(items, total, params)


@router.get("/{match_id}", response_model=MatchDetail, summary="Match detail with score breakdown")
def get_match(
    match_id: int,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> MatchDetail:
    match = _get_match_or_404(db, match_id)
    return serializers.match_detail(match, admin)


@router.post("/{match_id}/confirm", response_model=MatchDetail, summary="Confirm a match")
def confirm_match(
    match_id: int,
    payload: MatchReviewIn | None = None,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> MatchDetail:
    match = _get_match_or_404(db, match_id)
    if match.status == MatchStatus.CONFIRMED.value:
        raise ConflictError("This match is already confirmed.")
    if match.status == MatchStatus.REJECTED.value:
        raise ConflictError("This match was rejected; create a new report pair instead.")

    match.status = MatchStatus.CONFIRMED.value
    match.reviewed_by = admin.id
    match.reviewed_at = utcnow()
    match.review_note = (payload.note if payload else None) or None

    for report in (match.lost_report, match.found_report):
        if report.status == ReportStatus.OPEN.value:
            report.status = ReportStatus.MATCHED.value

    audit.record(
        db,
        actor_id=admin.id,
        action="match.confirm",
        entity="match",
        entity_id=match.id,
        meta={"score": match.score, "band": match.band},
    )
    for report in (match.lost_report, match.found_report):
        notification_service.notify(
            db,
            user_id=report.reporter_id,
            type=NotificationType.SYSTEM.value,
            title="Your item match was confirmed",
            body="An administrator confirmed the match. Please follow the handover instructions.",
            payload={"match_id": match.id, "report_id": report.id},
        )

    db.commit()
    db.refresh(match)
    return serializers.match_detail(match, admin)


@router.post("/{match_id}/reject", response_model=MatchDetail, summary="Reject a match")
def reject_match(
    match_id: int,
    payload: MatchReviewIn | None = None,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> MatchDetail:
    match = _get_match_or_404(db, match_id)
    if match.status == MatchStatus.CONFIRMED.value:
        raise ConflictError("A confirmed match cannot be rejected.")

    match.status = MatchStatus.REJECTED.value
    match.reviewed_by = admin.id
    match.reviewed_at = utcnow()
    match.review_note = (payload.note if payload else None) or None

    audit.record(
        db,
        actor_id=admin.id,
        action="match.reject",
        entity="match",
        entity_id=match.id,
        meta={"score": match.score, "band": match.band},
    )
    db.commit()
    db.refresh(match)
    return serializers.match_detail(match, admin)
