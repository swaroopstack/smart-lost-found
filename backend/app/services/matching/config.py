"""
Tunable constants for the matching engine.

This module is the single source of truth for every magic number used when
scoring a LOST/FOUND pair. It is exposed to clients through
``GET /api/v1/meta`` so the frontend can show the same numbers the backend
uses (useful for the admin "why did this match?" panel).
"""

from typing import Final

# --------------------------------------------------------------------------- #
# Signal weights (must sum to 1.0)
# --------------------------------------------------------------------------- #
DEFAULT_WEIGHTS: Final[dict[str, float]] = {
    "location": 0.30,
    "time": 0.25,
    "text": 0.20,
    "attributes": 0.15,
    "image": 0.10,
}

#: Per-category overrides. Each dict must also sum to 1.0.
CATEGORY_WEIGHT_OVERRIDES: Final[dict[str, dict[str, float]]] = {
    # An ID card is identified by its holder details, not by when it was found.
    "id_card": {"location": 0.25, "time": 0.15, "text": 0.15, "attributes": 0.35, "image": 0.10},
    # Bottles look alike; colour/brand matter more than the description.
    "bottle": {"location": 0.25, "time": 0.20, "text": 0.15, "attributes": 0.30, "image": 0.10},
    "calculator": {"location": 0.30, "time": 0.20, "text": 0.20, "attributes": 0.20, "image": 0.10},
    "books": {"location": 0.30, "time": 0.20, "text": 0.25, "attributes": 0.15, "image": 0.10},
    "keys_usb": {"location": 0.25, "time": 0.25, "text": 0.15, "attributes": 0.25, "image": 0.10},
}

# --------------------------------------------------------------------------- #
# Thresholds
# --------------------------------------------------------------------------- #
#: score >= HIGH_BAND   -> HIGH band   (notify users, still needs admin approval)
#: score >= MEDIUM_BAND -> MEDIUM band (admin verification queue only)
#: score <  MEDIUM_BAND -> discarded, not persisted
HIGH_BAND: Final[int] = 85
MEDIUM_BAND: Final[int] = 65

#: Hard filter: a found report is never paired with a lost report older than this.
MAX_GAP_DAYS: Final[int] = 14

#: Sloppy reporting tolerance: a "found" timestamp slightly before the "lost"
#: timestamp is treated as simultaneous instead of being rejected.
FOUND_BEFORE_LOST_GRACE_HOURS: Final[int] = 12

#: Bonus applied when the secret verification details agree.
HIDDEN_DETAIL_BONUS: Final[float] = 0.15
#: Token-overlap threshold for the hidden-detail bonus.
HIDDEN_DETAIL_MIN_SIMILARITY: Final[float] = 0.60


def weights_for(category_key: str | None) -> dict[str, float]:
    """Return the signal weights to use for a given category."""
    if category_key and category_key in CATEGORY_WEIGHT_OVERRIDES:
        return dict(CATEGORY_WEIGHT_OVERRIDES[category_key])
    return dict(DEFAULT_WEIGHTS)


def band_for(score: int) -> str | None:
    """Map a 0-100 score to a band, or ``None`` when the pair should be dropped."""
    if score >= HIGH_BAND:
        return "HIGH"
    if score >= MEDIUM_BAND:
        return "MEDIUM"
    return None


def as_public_dict() -> dict:
    """Serialisable snapshot used by ``GET /api/v1/meta``."""
    return {
        "default_weights": DEFAULT_WEIGHTS,
        "category_weight_overrides": CATEGORY_WEIGHT_OVERRIDES,
        "thresholds": {
            "high_band": HIGH_BAND,
            "medium_band": MEDIUM_BAND,
            "max_gap_days": MAX_GAP_DAYS,
            "found_before_lost_grace_hours": FOUND_BEFORE_LOST_GRACE_HOURS,
            "hidden_detail_bonus": HIDDEN_DETAIL_BONUS,
        },
    }
