"""Ownership claims: student submits proof, admin approves or rejects."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_staff
from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError
from app.core.pagination import PageParams, build_page, page_params, paginate
from app.db.base import utcnow
from app.db.session import get_db
from app.models.claim import Claim
from app.models.enums import ClaimStatus, MatchStatus, NotificationType, ReportStatus
from app.models.match import Match
from app.models.report import ItemReport
from app.models.user import User
from app.schemas.claim import ClaimCreate, ClaimDecisionIn, ClaimDetail
from app.services import audit, serializers
from app.services import notifications as notification_service

router = APIRouter(prefix="/claims", tags=["Claims"])
admin_router = APIRouter(prefix="/admin/claims", tags=["Admin: Claims"])


def _get_claim_or_404(db: Session, claim_id: int) -> Claim:
    claim = db.get(Claim, claim_id)
    if claim is None:
        raise NotFoundError(f"Claim {claim_id} does not exist.")
    return claim


@router.post(
    "",
    response_model=ClaimDetail,
    status_code=201,
    summary="Claim a matched item (answers the verification questions)",
)
def create_claim(
    payload: ClaimCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClaimDetail:
    match = db.get(Match, payload.match_id)
    if match is None:
        raise NotFoundError(f"Match {payload.match_id} does not exist.")
    if match.status == MatchStatus.REJECTED.value:
        raise ConflictError("This match was rejected by an administrator.")

    lost_report = match.lost_report
    if lost_report.reporter_id != user.id:
        raise PermissionDeniedError("You can only claim items from your own LOST reports.")
    if lost_report.status in {ReportStatus.RETURNED.value, ReportStatus.CLOSED.value}:
        raise ConflictError("This report is already resolved.")

    pending = db.execute(
        select(Claim.id).where(
            Claim.match_id == match.id,
            Claim.claimant_id == user.id,
            Claim.status == ClaimStatus.PENDING.value,
        )
    ).scalar_one_or_none()
    if pending:
        raise ConflictError("You already have a pending claim for this match.")

    claim = Claim(
        match_id=match.id,
        claimant_id=user.id,
        answers=payload.answers,
        status=ClaimStatus.PENDING.value,
    )
    db.add(claim)

    lost_report.status = ReportStatus.CLAIMED.value

    audit.record(
        db,
        actor_id=user.id,
        action="claim.create",
        entity="claim",
        entity_id=None,
        meta={"match_id": match.id},
    )
    notification_service.notify_admins(
        db,
        type=NotificationType.CLAIM_SUBMITTED.value,
        title=f"New ownership claim for {lost_report.title}",
        body="A student submitted proof of ownership. Please review the verification queue.",
        payload={"match_id": match.id},
    )

    db.commit()
    db.refresh(claim)
    return serializers.claim_detail(claim)


@router.get("/mine", response_model=dict, summary="My claims")
def my_claims(
    params: PageParams = Depends(page_params),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    stmt = (
        select(Claim)
        .where(Claim.claimant_id == user.id)
        .order_by(Claim.created_at.desc())
    )
    rows, total = paginate(db, stmt, params)
    return build_page([serializers.claim_out(claim) for claim in rows], total, params)


@admin_router.get("", response_model=dict, summary="All claims (admin)")
def list_claims(
    status_filter: ClaimStatus | None = Query(default=None, alias="status"),
    params: PageParams = Depends(page_params),
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(Claim).order_by(Claim.created_at.desc())
    if status_filter:
        stmt = stmt.where(Claim.status == status_filter.value)
    rows, total = paginate(db, stmt, params)
    return build_page([serializers.claim_detail(claim) for claim in rows], total, params)


@admin_router.post("/{claim_id}/approve", response_model=ClaimDetail, summary="Approve a claim")
def approve_claim(
    claim_id: int,
    payload: ClaimDecisionIn | None = None,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> ClaimDetail:
    claim = _get_claim_or_404(db, claim_id)
    if claim.status != ClaimStatus.PENDING.value:
        raise ConflictError(f"This claim is already {claim.status}.")

    match = claim.match
    lost_report = match.lost_report
    found_report = match.found_report

    claim.status = ClaimStatus.APPROVED.value
    claim.decided_by = admin.id
    claim.decided_at = utcnow()
    claim.notes = (payload.notes if payload else None) or None

    match.status = MatchStatus.CONFIRMED.value
    match.reviewed_by = admin.id
    match.reviewed_at = utcnow()

    lost_report.status = ReportStatus.RETURNED.value
    lost_report.closed_at = utcnow()
    found_report.status = ReportStatus.RETURNED.value
    found_report.closed_at = utcnow()

    audit.record(
        db,
        actor_id=admin.id,
        action="claim.approve",
        entity="claim",
        entity_id=claim.id,
        meta={"match_id": match.id},
    )
    notification_service.notify(
        db,
        user_id=claim.claimant_id,
        type=NotificationType.CLAIM_APPROVED.value,
        title="Your claim was approved",
        body="Collect your item from the security / admin desk.",
        payload={"claim_id": claim.id, "match_id": match.id},
    )
    notification_service.notify(
        db,
        user_id=found_report.reporter_id,
        type=NotificationType.CLAIM_APPROVED.value,
        title="The item you found was returned",
        body="Thank you for reporting it. The owner has been verified and notified.",
        payload={"claim_id": claim.id, "match_id": match.id},
    )

    db.commit()
    db.refresh(claim)
    return serializers.claim_detail(claim)


@admin_router.post("/{claim_id}/reject", response_model=ClaimDetail, summary="Reject a claim")
def reject_claim(
    claim_id: int,
    payload: ClaimDecisionIn | None = None,
    admin: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> ClaimDetail:
    claim = _get_claim_or_404(db, claim_id)
    if claim.status != ClaimStatus.PENDING.value:
        raise ConflictError(f"This claim is already {claim.status}.")

    claim.status = ClaimStatus.REJECTED.value
    claim.decided_by = admin.id
    claim.decided_at = utcnow()
    claim.notes = (payload.notes if payload else None) or None

    lost_report = claim.match.lost_report
    if lost_report.status == ReportStatus.CLAIMED.value:
        lost_report.status = ReportStatus.MATCHED.value

    audit.record(
        db,
        actor_id=admin.id,
        action="claim.reject",
        entity="claim",
        entity_id=claim.id,
        meta={"match_id": claim.match_id},
    )
    notification_service.notify(
        db,
        user_id=claim.claimant_id,
        type=NotificationType.CLAIM_REJECTED.value,
        title="Your claim was rejected",
        body="The details provided did not match the item. You can try again with more detail.",
        payload={"claim_id": claim.id, "match_id": claim.match_id},
    )

    db.commit()
    db.refresh(claim)
    return serializers.claim_detail(claim)
