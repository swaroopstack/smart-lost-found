"""Smart matching engine.

Sub-modules
-----------
``config``    tunable weights and thresholds (single source of truth)
``text``      free-text similarity (rapidfuzz)
``image``     perceptual hashing for photos
``scoring``   pure scoring functions
``blocking``  hard filters that reduce candidate pairs
``engine``    DB-aware orchestration
"""

from app.services.matching.config import band_for, weights_for
from app.services.matching.engine import (
    build_snapshot,
    field_defs_for,
    recompute_all,
    run_matching_for_report,
)
from app.services.matching.scoring import (
    FieldDef,
    ReportSnapshot,
    ScoreResult,
    compute_score,
)

__all__ = [
    "FieldDef",
    "ReportSnapshot",
    "ScoreResult",
    "band_for",
    "build_snapshot",
    "compute_score",
    "field_defs_for",
    "recompute_all",
    "run_matching_for_report",
    "weights_for",
]
