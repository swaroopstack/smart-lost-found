"""Lost / found report endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from app.core.pagination import PageParams, build_page, page_params, paginate
from app.db.base import as_naive_utc, utcnow
from app.db.session import get_db
from app.models.catalog import Category, CategoryField
from app.models.enums import ReportStatus, ReportType
from app.models.location import Location
from app.models.match import Match
from app.models.report import ItemReport
from app.models.user import User
from app.schemas.common import Message
from app.schemas.match import MatchOut
from app.schemas.report import ReportCloseIn, ReportCreate, ReportDetail, ReportPublic, ReportUpdate
from app.services import serializers
from app.services.matching.engine import run_matching_for_report
from app.services.uploads import store_image

router = APIRouter(prefix="/reports", tags=["Reports"])

#: Reports in these states can still be edited by their owner.
_EDITABLE = {ReportStatus.OPEN.value, ReportStatus.MATCHED.value}
#: Reports in these states are finished.
_FINAL = {ReportStatus.RETURNED.value, ReportStatus.CLOSED.value, ReportStatus.EXPIRED.value}
#: Tolerated clock skew for "occurred_at" in the future.
_FUTURE_TOLERANCE = timedelta(days=1)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def get_report_or_404(db: Session, report_id: int) -> ItemReport:
    report = db.get(ItemReport, report_id)
    if report is None:
        raise NotFoundError(f"Report {report_id} does not exist.")
    return report


def _get_category(db: Session, key: str) -> Category:
    category = db.execute(select(Category).where(Category.key == key)).scalar_one_or_none()
    if category is None:
        raise NotFoundError(f"Category '{key}' does not exist.")
    return category


def _get_location(db: Session, location_id: int | None) -> Location | None:
    if location_id is None:
        return None
    location = db.get(Location, location_id)
    if location is None:
        raise ValidationError("Unknown location.", fields={"location_id": "Does not exist"})
    return location


def _validate_attributes(
    db: Session,
    category: Category,
    attributes: dict,
) -> None:
    fields = db.execute(
        select(CategoryField).where(CategoryField.category_id == category.id)
    ).scalars().all()
    known = {field.key for field in fields}

    errors: dict[str, str] = {}
    for field in fields:
        # Hidden fields are verification secrets: always optional, because a
        # finder cannot know them.
        if field.is_required and not field.is_hidden:
            value = attributes.get(field.key)
            if value in (None, "", []):
                errors[field.key] = "This field is required"
    for key in attributes:
        if key not in known:
            errors[key] = f"Unknown attribute for category '{category.key}'"

    if errors:
        raise ValidationError("Invalid attributes for this category.", fields=errors)


def _assert_owner_or_admin(report: ItemReport, user: User) -> None:
    if report.reporter_id != user.id and not user.is_admin:
        raise PermissionDeniedError("You can only modify your own reports.")


def _match_count(db: Session, report_id: int) -> int:
    from sqlalchemy import func

    return db.execute(
        select(func.count(Match.id)).where(
            or_(Match.lost_report_id == report_id, Match.found_report_id == report_id)
        )
    ).scalar_one()


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@router.post(
    "",
    response_model=ReportDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a LOST or FOUND report (matching runs immediately)",
)
def create_report(
    payload: ReportCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetail:
    category = _get_category(db, payload.category_key)
    location = _get_location(db, payload.location_id)
    deposited = _get_location(db, payload.deposited_location_id)
    _validate_attributes(db, category, payload.attributes)

    occurred_at = as_naive_utc(payload.occurred_at)
    if occurred_at is None:
        raise ValidationError("occurred_at is required.", fields={"occurred_at": "Required"})
    if occurred_at > utcnow() + _FUTURE_TOLERANCE:
        raise ValidationError(
            "occurred_at cannot be in the future.",
            fields={"occurred_at": "Must be now or earlier"},
        )

    report = ItemReport(
        reporter_id=user.id,
        type=payload.type.value,
        category_id=category.id,
        title=payload.title.strip(),
        public_description=(payload.public_description or "").strip() or None,
        hidden_detail=(payload.hidden_detail or "").strip() or None,
        attributes=payload.attributes,
        location_id=location.id if location else None,
        occurred_at=occurred_at,
        status=ReportStatus.OPEN.value,
        deposited_location_id=deposited.id if deposited else None,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    run_matching_for_report(db, report)
    db.commit()
    db.refresh(report)

    return serializers.report_detail(report, user, matches_count=_match_count(db, report.id))


@router.get("", response_model=dict, summary="List / search reports")
def list_reports(
    type: ReportType | None = Query(default=None),
    category: str | None = Query(default=None, description="Category key, e.g. 'calculator'"),
    location_id: int | None = Query(default=None, description="Include this location and its children"),
    status_filter: ReportStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=120, description="Search title + description"),
    mine: bool = Query(default=False, description="Only my own reports"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    params: PageParams = Depends(page_params),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    stmt = (
        select(ItemReport)
        .options(
            selectinload(ItemReport.category).selectinload(Category.fields),
            selectinload(ItemReport.location),
            selectinload(ItemReport.reporter),
        )
        .order_by(ItemReport.created_at.desc(), ItemReport.id.desc())
    )

    if type:
        stmt = stmt.where(ItemReport.type == type.value)
    if category:
        stmt = stmt.join(Category, ItemReport.category_id == Category.id).where(
            Category.key == category
        )
    if location_id is not None:
        location = db.get(Location, location_id)
        if location is None:
            raise NotFoundError(f"Location {location_id} does not exist.")
        stmt = stmt.where(ItemReport.location.has(Location.path.like(f"{location.path}%")))
    if status_filter:
        stmt = stmt.where(ItemReport.status == status_filter.value)
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(ItemReport.title.ilike(pattern), ItemReport.public_description.ilike(pattern))
        )
    if mine:
        stmt = stmt.where(ItemReport.reporter_id == user.id)
    if date_from:
        stmt = stmt.where(ItemReport.occurred_at >= as_naive_utc(date_from))
    if date_to:
        stmt = stmt.where(ItemReport.occurred_at <= as_naive_utc(date_to))

    rows, total = paginate(db, stmt, params)
    items = [serializers.report_public(report, user) for report in rows]
    return build_page(items, total, params)


@router.get("/{report_id}", response_model=ReportDetail, summary="Report detail")
def get_report(
    report_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetail:
    report = get_report_or_404(db, report_id)
    return serializers.report_detail(report, user, matches_count=_match_count(db, report_id))


@router.patch("/{report_id}", response_model=ReportDetail, summary="Edit your report")
def update_report(
    report_id: int,
    payload: ReportUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetail:
    report = get_report_or_404(db, report_id)
    _assert_owner_or_admin(report, user)

    if report.status not in _EDITABLE and not user.is_admin:
        raise ConflictError(f"A report in status {report.status} can no longer be edited.")

    data = payload.model_dump(exclude_unset=True)

    if "attributes" in data and data["attributes"] is not None:
        _validate_attributes(db, report.category, data["attributes"])
        report.attributes = data["attributes"]

    if "location_id" in data:
        location = _get_location(db, data["location_id"])
        report.location_id = location.id if location else None

    if "deposited_location_id" in data:
        deposited = _get_location(db, data["deposited_location_id"])
        report.deposited_location_id = deposited.id if deposited else None

    if "occurred_at" in data and data["occurred_at"] is not None:
        occurred_at = as_naive_utc(data["occurred_at"])
        if occurred_at > utcnow() + _FUTURE_TOLERANCE:
            raise ValidationError(
                "occurred_at cannot be in the future.",
                fields={"occurred_at": "Must be now or earlier"},
            )
        report.occurred_at = occurred_at

    for field in ("title", "public_description", "hidden_detail"):
        if field in data and data[field] is not None:
            setattr(report, field, str(data[field]).strip() or None)

    db.commit()
    db.refresh(report)

    # Changing location/time/attributes can change the score, so recompute.
    run_matching_for_report(db, report)
    db.commit()
    db.refresh(report)

    return serializers.report_detail(report, user, matches_count=_match_count(db, report_id))


@router.post(
    "/{report_id}/photo",
    response_model=ReportDetail,
    summary="Attach or replace the photo (multipart/form-data, field name 'photo')",
)
def upload_photo(
    report_id: int,
    photo: UploadFile = File(..., description="jpeg / png / webp, max 5 MB by default"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetail:
    report = get_report_or_404(db, report_id)
    _assert_owner_or_admin(report, user)

    relative_path, phash = store_image(photo, subdir="reports")
    report.photo_path = relative_path
    report.photo_hash = phash
    db.commit()
    db.refresh(report)

    # The photo is a matching signal, so refresh the scores.
    run_matching_for_report(db, report)
    db.commit()
    db.refresh(report)

    return serializers.report_detail(report, user, matches_count=_match_count(db, report_id))


@router.post("/{report_id}/close", response_model=Message, summary="Close your report")
def close_report(
    report_id: int,
    payload: ReportCloseIn | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    report = get_report_or_404(db, report_id)
    _assert_owner_or_admin(report, user)

    if report.status in _FINAL:
        raise ConflictError(f"Report is already {report.status}.")

    report.status = ReportStatus.CLOSED.value
    report.closed_at = utcnow()
    if payload and payload.reason:
        report.admin_note = payload.reason
    db.commit()
    return Message(message="Report closed.")


@router.get(
    "/{report_id}/matches",
    response_model=list[MatchOut],
    summary="Possible matches for this report (owner or admin)",
)
def report_matches(
    report_id: int,
    min_score: int = Query(default=0, ge=0, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MatchOut]:
    report = get_report_or_404(db, report_id)
    if report.reporter_id != user.id and not user.is_admin:
        raise PermissionDeniedError("You can only see matches for your own reports.")

    stmt = (
        select(Match)
        .where(
            or_(Match.lost_report_id == report_id, Match.found_report_id == report_id),
            Match.score >= min_score,
        )
        .order_by(Match.score.desc())
    )
    matches = db.execute(stmt).unique().scalars().all()
    return [serializers.match_out(match, user) for match in matches]
