"""
Hard filters ("blocking").

Comparing every lost report with every found report is both slow and noisy.
These cheap checks run first and reduce the candidate set from O(n*m) to a
handful of plausible pairs. Anything rejected here is never scored.
"""

from __future__ import annotations

from datetime import timedelta

from app.services.matching import config
from app.services.matching.scoring import ReportSnapshot


def is_candidate_pair(
    lost: ReportSnapshot,
    found: ReportSnapshot,
    max_gap_days: int = config.MAX_GAP_DAYS,
    grace_hours: int = config.FOUND_BEFORE_LOST_GRACE_HOURS,
) -> tuple[bool, str]:
    """Decide whether two reports are worth scoring.

    Returns ``(True, "ok")`` or ``(False, <reason>)`` - the reason string is
    logged so a reviewer can see why a pair was discarded.
    """
    if lost.type != "LOST" or found.type != "FOUND":
        return False, "wrong_report_types"

    if lost.category_key != found.category_key:
        return False, "category_mismatch"

    if lost.id == found.id:
        return False, "same_report"

    earliest = lost.occurred_at - timedelta(hours=grace_hours)
    if found.occurred_at < earliest:
        return False, "found_before_lost"

    if found.occurred_at - lost.occurred_at > timedelta(days=max_gap_days):
        return False, "outside_time_window"

    return True, "ok"
