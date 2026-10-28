"""
ORM -> schema serialisation with the privacy rules applied in one place.

Keeping this logic here (instead of inside routers) guarantees that the same
redaction rules apply everywhere, including match suggestions.
"""

from __future__ import annotations

from app.core.config import settings
from app.models.catalog import Category
from app.models.claim import Claim
from app.models.location import Location
from app.models.match import Match
from app.models.report import ItemReport
from app.models.user import User
from app.schemas.catalog import CategoryOut, LocationOut
from app.schemas.claim import ClaimDetail, ClaimOut
from app.schemas.match import MatchDetail, MatchOut
from app.schemas.report import ReportDetail, ReportPublic
from app.schemas.user import UserBrief


def photo_url(report: ItemReport) -> str | None:
    if not report.photo_path:
        return None
    return f"{settings.media_url_prefix}/{report.photo_path}"


def category_out(category: Category) -> CategoryOut:
    return CategoryOut(
        id=category.id,
        key=category.key,
        label=category.label,
        icon=category.icon,
        description=category.description,
        is_active=category.is_active,
        sort_order=category.sort_order,
        field_count=len(category.fields) if category.fields is not None else 0,
    )


def location_out(location: Location | None) -> LocationOut | None:
    if location is None:
        return None
    return LocationOut(
        id=location.id,
        name=location.name,
        type=location.type,
        parent_id=location.parent_id,
        path=location.path,
        depth=location.depth,
    )


def _split_attributes(
    report: ItemReport, viewer: User | None
) -> tuple[dict, dict]:
    """Return ``(public_attributes, hidden_attributes)`` for this viewer."""
    attributes = dict(report.attributes or {})
    hidden_keys = {
        field.key for field in (report.category.fields if report.category else []) if field.is_hidden
    }
    public = {k: v for k, v in attributes.items() if k not in hidden_keys}
    if not hidden_keys:
        return public, {}

    hidden = {k: v for k, v in attributes.items() if k in hidden_keys}
    can_see = viewer is not None and (viewer.is_admin or viewer.id == report.reporter_id)
    return public, (hidden if can_see else {})


def _can_see_identity(report: ItemReport, viewer: User | None) -> bool:
    if viewer is None:
        return False
    return viewer.is_admin or viewer.id == report.reporter_id


def report_public(report: ItemReport, viewer: User | None = None) -> ReportPublic:
    return ReportPublic(
        id=report.id,
        type=report.type,
        category=category_out(report.category),
        title=report.title,
        public_description=report.public_description,
        location=location_out(report.location),
        occurred_at=report.occurred_at,
        status=report.status,
        photo_url=photo_url(report),
        reporter_id=report.reporter_id,
        reporter_name=(
            report.reporter.full_name if _can_see_identity(report, viewer) and report.reporter else None
        ),
        is_mine=bool(viewer and viewer.id == report.reporter_id),
        has_hidden_detail=bool(report.hidden_detail),
        created_at=report.created_at,
    )


def report_detail(
    report: ItemReport,
    viewer: User | None = None,
    *,
    matches_count: int = 0,
) -> ReportDetail:
    public_attrs, hidden_attrs = _split_attributes(report, viewer)
    base = report_public(report, viewer)
    return ReportDetail(
        **base.model_dump(),
        attributes=public_attrs,
        hidden_attributes=hidden_attrs,
        deposited_location=location_out(report.deposited_location),
        admin_note=report.admin_note if _can_see_identity(report, viewer) else None,
        matches_count=matches_count,
        updated_at=report.updated_at,
    )


def match_out(match: Match, viewer: User | None = None) -> MatchOut:
    return MatchOut(
        id=match.id,
        score=match.score,
        band=match.band,
        status=match.status,
        lost_report=report_public(match.lost_report, viewer),
        found_report=report_public(match.found_report, viewer),
        created_at=match.created_at,
        reviewed_at=match.reviewed_at,
    )


def match_detail(match: Match, viewer: User | None = None) -> MatchDetail:
    base = match_out(match, viewer)
    return MatchDetail(
        **base.model_dump(),
        score_breakdown=match.score_breakdown or {},
        review_note=match.review_note,
        reviewed_by=match.reviewed_by,
    )


def claim_out(claim: Claim) -> ClaimOut:
    return ClaimOut(
        id=claim.id,
        match_id=claim.match_id,
        claimant=UserBrief.model_validate(claim.claimant),
        status=claim.status,
        notes=claim.notes,
        created_at=claim.created_at,
        decided_at=claim.decided_at,
    )


def claim_detail(claim: Claim) -> ClaimDetail:
    base = claim_out(claim)
    return ClaimDetail(
        **base.model_dump(),
        answers=claim.answers or {},
        decided_by=claim.decided_by,
    )
