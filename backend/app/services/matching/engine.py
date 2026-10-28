"""
The DB-aware orchestration layer of the matching engine.

Public entry point: :func:`run_matching_for_report`. It is called every time a
report is created or updated, so matches appear instantly instead of waiting
for a cron job.

Flow
----
1. Load candidate reports of the opposite type in the same category and time
   window (SQL does the cheap filtering).
2. Apply :func:`~app.services.matching.blocking.is_candidate_pair`.
3. Score each surviving pair with
   :func:`~app.services.matching.scoring.compute_score`.
4. Upsert a ``matches`` row for anything at or above ``MEDIUM_BAND``.
5. Notify both reporters when a ``HIGH`` band match appears.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import MatchBand, MatchStatus, NotificationType, ReportStatus, ReportType
from app.models.match import Match
from app.models.report import ItemReport
from app.services import notifications as notification_service
from app.services.matching import config
from app.services.matching.blocking import is_candidate_pair
from app.services.matching.scoring import (
    FieldDef,
    ReportSnapshot,
    ScoreResult,
    compute_score,
)

#: Reports in these states are finished and never re-matched.
_FINAL_STATES = {
    ReportStatus.RETURNED.value,
    ReportStatus.CLOSED.value,
    ReportStatus.EXPIRED.value,
}


# --------------------------------------------------------------------------- #
# Snapshot helpers
# --------------------------------------------------------------------------- #
def build_snapshot(report: ItemReport, category_key: str | None = None) -> ReportSnapshot:
    """Flatten an ORM report into the plain dataclass the scorers expect."""
    return ReportSnapshot(
        id=report.id,
        type=report.type,
        category_key=category_key,
        public_description=report.public_description,
        attributes=report.attributes or {},
        location_path=report.location.path if report.location else None,
        occurred_at=report.occurred_at,
        photo_hash=report.photo_hash,
        hidden_detail=report.hidden_detail,
    )


def field_defs_for(db: Session, category_id: int | None) -> list[FieldDef]:
    """Load the attribute definitions of a category as scoring field defs."""
    if not category_id:
        return []
    from app.models.catalog import CategoryField

    rows = db.execute(
        select(CategoryField).where(CategoryField.category_id == category_id)
    ).scalars().all()
    return [FieldDef(key=f.key, type=f.type, is_hidden=f.is_hidden) for f in rows]


# --------------------------------------------------------------------------- #
# Candidate lookup
# --------------------------------------------------------------------------- #
def _candidate_reports(db: Session, report: ItemReport) -> list[ItemReport]:
    """Reports of the opposite type that could plausibly match ``report``."""
    opposite = (
        ReportType.FOUND.value if report.type == ReportType.LOST.value else ReportType.LOST.value
    )
    window = timedelta(days=config.MAX_GAP_DAYS, hours=config.FOUND_BEFORE_LOST_GRACE_HOURS)

    stmt = (
        select(ItemReport)
        .where(
            ItemReport.type == opposite,
            ItemReport.category_id == report.category_id,
            ItemReport.status.notin_(_FINAL_STATES),
            ItemReport.occurred_at >= report.occurred_at - window,
            ItemReport.occurred_at <= report.occurred_at + window,
            ItemReport.id != report.id,
        )
        .order_by(ItemReport.occurred_at)
    )
    return list(db.execute(stmt).scalars().all())


def _pair_key(lost_id: int, found_id: int) -> tuple[int, int]:
    return (lost_id, found_id)


# --------------------------------------------------------------------------- #
# Main entry point
# --------------------------------------------------------------------------- #
def run_matching_for_report(
    db: Session,
    report: ItemReport,
    *,
    notify: bool = True,
) -> list[Match]:
    """(Re)compute matches for a single report and return the persisted rows.

    The caller is responsible for committing the session.
    """
    if report.status in _FINAL_STATES:
        return []

    category_key = report.category.key if report.category else None
    fields = field_defs_for(db, report.category_id)
    snapshot = build_snapshot(report, category_key)
    is_lost = report.type == ReportType.LOST.value

    # Existing rows for this report, keyed by pair, so we can update in place.
    existing_stmt = select(Match).where(
        (Match.lost_report_id == report.id) | (Match.found_report_id == report.id)
    )
    existing = {
        _pair_key(m.lost_report_id, m.found_report_id): m
        for m in db.execute(existing_stmt).scalars().all()
    }

    produced: dict[tuple[int, int], Match] = {}
    new_high_band: list[Match] = []

    for candidate in _candidate_reports(db, report):
        candidate_key = candidate.category.key if candidate.category else category_key
        candidate_snapshot = build_snapshot(candidate, candidate_key)

        lost_snap, found_snap = (
            (snapshot, candidate_snapshot) if is_lost else (candidate_snapshot, snapshot)
        )

        ok, _reason = is_candidate_pair(lost_snap, found_snap)
        if not ok:
            continue

        result: ScoreResult = compute_score(lost_snap, found_snap, fields)
        if result.band is None:
            continue

        key = _pair_key(lost_snap.id, found_snap.id)
        match = existing.get(key)

        if match is None:
            match = Match(
                lost_report_id=lost_snap.id,
                found_report_id=found_snap.id,
                score=result.score,
                score_breakdown=result.breakdown,
                band=result.band,
                status=MatchStatus.SUGGESTED.value,
            )
            db.add(match)
            if result.band == MatchBand.HIGH.value:
                new_high_band.append(match)
        elif match.status == MatchStatus.SUGGESTED.value:
            # Refresh the score while nobody has reviewed it yet.
            match.score = result.score
            match.score_breakdown = result.breakdown
            match.band = result.band

        produced[key] = match

    # Drop stale suggestions that no longer qualify (e.g. after an edit).
    for key, match in existing.items():
        if key not in produced and match.status == MatchStatus.SUGGESTED.value:
            db.delete(match)

    # A report with any live suggestion is considered MATCHED, on both sides,
    # so the state machine stays consistent no matter which report came second.
    if produced:
        if report.status == ReportStatus.OPEN.value:
            report.status = ReportStatus.MATCHED.value
        for match in produced.values():
            counterpart_id = match.found_report_id if is_lost else match.lost_report_id
            counterpart = db.get(ItemReport, counterpart_id)
            if counterpart is not None and counterpart.status == ReportStatus.OPEN.value:
                counterpart.status = ReportStatus.MATCHED.value

    db.flush()

    if notify:
        for match in new_high_band:
            _notify_high_band(db, match, report)

    return list(produced.values())


def _notify_high_band(db: Session, match: Match, report: ItemReport) -> None:
    """Tell both sides that a strong possible match was found."""
    lost = db.get(ItemReport, match.lost_report_id)
    found = db.get(ItemReport, match.found_report_id)
    if not lost or not found:
        return

    for owner, other in ((lost, found), (found, lost)):
        notification_service.notify(
            db,
            user_id=owner.reporter_id,
            type=NotificationType.MATCH_FOUND.value,
            title=f"Possible match for your {owner.title}",
            body=(
                f"We found a {match.score}% possible match in "
                f"{other.location.name if other.location else 'an unknown location'}. "
                "An admin will verify ownership before release."
            ),
            payload={
                "match_id": match.id,
                "report_id": owner.id,
                "counterpart_report_id": other.id,
                "score": match.score,
                "band": match.band,
            },
        )


def recompute_all(db: Session) -> int:
    """Re-run matching for every active report. Returns the number processed."""
    stmt = select(ItemReport).where(ItemReport.status.notin_(_FINAL_STATES))
    reports = db.execute(stmt).scalars().all()
    for report in reports:
        run_matching_for_report(db, report, notify=False)
    db.flush()
    return len(reports)
