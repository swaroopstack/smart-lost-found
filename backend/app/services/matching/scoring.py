"""
Pure scoring functions.

Everything in this module is a pure function of plain data - no database, no
FastAPI. That makes the maths unit-testable and easy to reason about in a
review. :mod:`app.services.matching.engine` is the DB-aware layer.

Score shape::

    base   = sum(weight_i * signal_i) / sum(weight_i)     # over *available* signals
    final  = clamp(base + hidden_detail_bonus) * 100

Signals that cannot be computed (no photo on either report, no attributes
filled in) are **dropped and the weights renormalised**, so a report is never
punished for information the reporter did not provide.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Sequence

from app.services.matching import config
from app.services.matching.image import image_similarity
from app.services.matching.text import hidden_detail_similarity, text_similarity

# --------------------------------------------------------------------------- #
# Data carriers
# --------------------------------------------------------------------------- #


@dataclass(slots=True)
class FieldDef:
    """A category attribute definition needed for scoring."""

    key: str
    type: str = "TEXT"
    is_hidden: bool = False


@dataclass(slots=True)
class ReportSnapshot:
    """A flattened, database-free view of a report."""

    id: int
    type: str
    category_key: str | None
    public_description: str | None
    attributes: dict
    location_path: str | None
    occurred_at: datetime
    photo_hash: str | None = None
    hidden_detail: str | None = None


@dataclass(slots=True)
class ScoreResult:
    score: int
    band: str | None
    breakdown: dict = field(default_factory=dict)


# --------------------------------------------------------------------------- #
# Individual signals
# --------------------------------------------------------------------------- #


def location_score(lost_path: str | None, found_path: str | None) -> float | None:
    """Compare two materialised location paths.

    ``Main Block/Block B/Second Floor/Room 204`` vs
    ``Main Block/Block B/Second Floor/Room 205`` -> same floor, so 0.80.
    """
    if not lost_path or not found_path:
        return None

    a = [part.strip().lower() for part in lost_path.split("/") if part.strip()]
    b = [part.strip().lower() for part in found_path.split("/") if part.strip()]
    if not a or not b:
        return None
    if a == b:
        return 1.0

    common = 0
    for left, right in zip(a, b):
        if left == right:
            common += 1
        else:
            break

    if common == 0:
        return 0.15

    depth = max(len(a), len(b))
    if common >= depth - 1:  # same parent: adjacent rooms on one floor
        return 0.80
    if common >= 2:  # same block, different floor
        return 0.60
    return 0.40  # same building, different block


def time_score(
    lost_at: datetime,
    found_at: datetime,
    grace_hours: int = config.FOUND_BEFORE_LOST_GRACE_HOURS,
) -> float:
    """Piecewise decay of the gap between the lost and found timestamps.

    Deliberately piecewise rather than exponential: it is trivial to explain
    in a report or a viva ("under 2 hours is a perfect time match").
    """
    gap_hours = (found_at - lost_at).total_seconds() / 3600.0
    if gap_hours < -grace_hours:
        return 0.0
    if gap_hours < 0:
        gap_hours = 0.0
    if gap_hours <= 2:
        return 1.0
    if gap_hours <= 24:
        return 0.85
    if gap_hours <= 72:
        return 0.60
    if gap_hours <= 168:
        return 0.35
    if gap_hours <= 336:
        return 0.15
    return 0.0


def _coerce(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value).strip().lower()


def attribute_score(
    lost_attrs: dict | None,
    found_attrs: dict | None,
    fields: Sequence[FieldDef],
) -> float | None:
    """Average per-field agreement over the fields both reports filled in.

    Missing values are *skipped*, not penalised. Conflicting values are
    heavily penalised (``0.1``) because "red bottle" vs "blue bottle" is
    strong evidence of different items.
    """
    if not fields:
        return None
    lost_attrs = lost_attrs or {}
    found_attrs = found_attrs or {}

    from rapidfuzz import fuzz  # local import keeps module import cheap

    scores: list[float] = []
    for definition in fields:
        left = lost_attrs.get(definition.key)
        right = found_attrs.get(definition.key)
        if left in (None, "", [], {}) or right in (None, "", [], {}):
            continue

        left_s, right_s = _coerce(left), _coerce(right)
        if left_s == right_s:
            scores.append(1.0)
            continue

        similarity = fuzz.ratio(left_s, right_s) / 100.0
        if similarity >= 0.80:
            scores.append(0.60)
        elif similarity >= 0.50:
            scores.append(0.35)
        else:
            scores.append(0.10)

    if not scores:
        return None
    return round(sum(scores) / len(scores), 4)


# --------------------------------------------------------------------------- #
# Combined score
# --------------------------------------------------------------------------- #


def compute_score(
    lost: ReportSnapshot,
    found: ReportSnapshot,
    fields: Sequence[FieldDef] = (),
) -> ScoreResult:
    """Score one LOST/FOUND pair and return the full explanation."""
    weights = config.weights_for(lost.category_key or found.category_key)

    signals: dict[str, float | None] = {
        "location": location_score(lost.location_path, found.location_path),
        "time": time_score(lost.occurred_at, found.occurred_at),
        "text": text_similarity(lost.public_description, found.public_description),
        "attributes": attribute_score(lost.attributes, found.attributes, fields),
        "image": image_similarity(lost.photo_hash, found.photo_hash),
    }

    available = {name: value for name, value in signals.items() if value is not None}
    total_weight = sum(weights[name] for name in available)

    if total_weight <= 0:  # pragma: no cover - defensive
        return ScoreResult(score=0, band=None, breakdown={"reason": "no comparable signals"})

    effective_weights = {name: round(weights[name] / total_weight, 4) for name in available}
    base = sum(weights[name] * value for name, value in available.items()) / total_weight

    detail_similarity = hidden_detail_similarity(lost.hidden_detail, found.hidden_detail)
    bonus = (
        config.HIDDEN_DETAIL_BONUS
        if detail_similarity >= config.HIDDEN_DETAIL_MIN_SIMILARITY
        else 0.0
    )

    final = max(0.0, min(1.0, base + bonus))
    score = int(round(final * 100))

    breakdown = {
        "signals": {name: signals[name] for name in signals},
        "effective_weights": effective_weights,
        "weights_used": {name: weights[name] for name in available},
        "signals_used": sorted(available.keys()),
        "signals_missing": sorted(name for name, value in signals.items() if value is None),
        "base_score": round(base * 100, 2),
        "hidden_detail_similarity": round(detail_similarity, 4),
        "hidden_detail_bonus": round(bonus * 100, 2),
        "final_score": score,
        "band": config.band_for(score),
    }
    return ScoreResult(score=score, band=config.band_for(score), breakdown=breakdown)
