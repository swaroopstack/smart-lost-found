"""Admin dashboard endpoints: today's stats, verification queue, users, audit log."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_admin, require_staff
from app.core.errors import ConflictError, NotFoundError
from app.core.pagination import PageParams, build_page, page_params, paginate
from app.db.base import utcnow
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.claim import Claim
from app.models.enums import ClaimStatus, MatchStatus, ReportStatus, ReportType
from app.models.match import Match
from app.models.report import ItemReport
from app.models.user import User
from app.schemas.admin import AuditLogOut, StatsToday, VerificationQueueItem
from app.schemas.user import RoleUpdate, UserOut
from app.services import audit, serializers

router = APIRouter(prefix="/admin", tags=["Admin"])


def _count(db: Session, stmt) -> int:
    return db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()


@router.get("/stats/today", response_model=StatsToday, summary="Dashboard counters for today")
def stats_today(
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> StatsToday:
    now = utcnow()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    created_today = [ItemReport.created_at >= start, ItemReport.created_at < end]

    lost_today = _count(
        db, select(ItemReport.id).where(*created_today, ItemReport.type == ReportType.LOST.value)
    )
    found_today = _count(
        db, select(ItemReport.id).where(*created_today, ItemReport.type == ReportType.FOUND.value)
    )
    matches_today = _count(
        db,
        select(Match.id).where(
            Match.created_at >= start,
            Match.created_at < end,
            Match.status != MatchStatus.REJECTED.value,
        ),
    )
    returned_today = _count(
        db,
        select(Claim.id).where(
            Claim.status == ClaimStatus.APPROVED.value,
            Claim.decided_at >= start,
            Claim.decided_at < end,
        ),
    )
    pending_claims = _count(
        db, select(Claim.id).where(Claim.status == ClaimStatus.PENDING.value)
    )
    open_reports = _count(
        db, select(ItemReport.id).where(ItemReport.status == ReportStatus.OPEN.value)
    )

    return StatsToday(
        date=start.date().isoformat(),
        lost_reports=lost_today,
        found_reports=found_today,
        possible_matches=matches_today,
        items_returned=returned_today,
        pending_claims=pending_claims,
        open_reports=open_reports,
    )


@router.get(
    "/verification-queue",
    response_model=list[VerificationQueueItem],
    summary="Unreviewed matches, highest score first",
)
def verification_queue(
    limit: int = Query(default=20, ge=1, le=100),
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> list[VerificationQueueItem]:
    stmt = (
        select(Match)
        .where(Match.status == MatchStatus.SUGGESTED.value)
        .order_by(Match.score.desc(), Match.created_at.desc())
        .limit(limit)
    )
    matches = db.execute(stmt).unique().scalars().all()
    return [
        VerificationQueueItem(
            match_id=match.id,
            score=match.score,
            band=match.band,
            status=match.status,
            lost_report=serializers.report_public(match.lost_report, admin),
            found_report=serializers.report_public(match.found_report, admin),
            created_at=match.created_at,
        )
        for match in matches
    ]


@router.get("/users", response_model=dict, summary="List users")
def list_users(
    q: str | None = Query(default=None, max_length=120),
    params: PageParams = Depends(page_params),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where((User.full_name.ilike(pattern)) | (User.email.ilike(pattern)))
    rows, total = paginate(db, stmt, params)
    return build_page([UserOut.model_validate(user) for user in rows], total, params)


@router.patch("/users/{user_id}/role", response_model=UserOut, summary="Change a user's role")
def update_user_role(
    user_id: int,
    payload: RoleUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} does not exist.")
    if user.id == admin.id and payload.role.value != "ADMIN":
        raise ConflictError("You cannot remove your own admin role.")

    user.role = payload.role.value
    audit.record(
        db,
        actor_id=admin.id,
        action="user.role_change",
        entity="user",
        entity_id=user.id,
        meta={"role": payload.role.value},
    )
    db.commit()
    db.refresh(user)
    return user


@router.get("/audit-log", response_model=dict, summary="Recent admin actions")
def audit_log(
    action: str | None = Query(default=None, max_length=60),
    params: PageParams = Depends(page_params),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        stmt = stmt.where(AuditLog.action == action)
    rows, total = paginate(db, stmt, params)
    return build_page([AuditLogOut.model_validate(row) for row in rows], total, params)
