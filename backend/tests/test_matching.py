"""Unit tests for the pure scoring functions (no database involved)."""

from datetime import datetime, timedelta

import numpy as np
from PIL import Image

from app.services.matching import config
from app.services.matching.image import compute_phash, hamming_distance, image_similarity
from app.services.matching.scoring import (
    FieldDef,
    ReportSnapshot,
    attribute_score,
    compute_score,
    location_score,
    time_score,
)
from app.services.matching.text import hidden_detail_similarity, text_similarity

BASE = datetime(2026, 9, 5, 11, 20)


# --------------------------------------------------------------------------- #
# Location
# --------------------------------------------------------------------------- #
def test_location_same_room_is_perfect():
    path = "Main Block/Block B/Second Floor/Room 204"
    assert location_score(path, path) == 1.0


def test_location_adjacent_room_on_same_floor():
    a = "Main Block/Block B/Second Floor/Room 204"
    b = "Main Block/Block B/Second Floor/Room 205"
    assert location_score(a, b) == 0.8


def test_location_same_building_different_block():
    a = "Main Block/Block A/Ground Floor/Room A-101"
    b = "Main Block/Block B/Second Floor/Room 204"
    assert location_score(a, b) == 0.4


def test_location_same_block_different_floor():
    a = "Main Block/Block A/Ground Floor/Room A-101"
    b = "Main Block/Block A/First Floor/Room A-201"
    assert location_score(a, b) == 0.6


def test_location_different_building():
    a = "Main Block/Library/Reading Hall"
    b = "North Block/Library/Reading Hall"
    assert location_score(a, b) == 0.15


def test_location_missing_returns_none():
    assert location_score(None, "Main Block/Block A") is None


# --------------------------------------------------------------------------- #
# Time
# --------------------------------------------------------------------------- #
def test_time_within_two_hours():
    assert time_score(BASE, BASE + timedelta(minutes=10)) == 1.0


def test_time_same_day():
    assert time_score(BASE, BASE + timedelta(hours=8)) == 0.85


def test_time_three_days():
    assert time_score(BASE, BASE + timedelta(days=3)) == 0.6


def test_time_beyond_window():
    assert time_score(BASE, BASE + timedelta(days=20)) == 0.0


def test_time_slightly_before_is_tolerated():
    # 30 minutes of clock skew should be treated as simultaneous, not rejected.
    assert time_score(BASE, BASE - timedelta(minutes=30)) == 1.0


def test_time_far_before_is_zero():
    assert time_score(BASE, BASE - timedelta(days=2)) == 0.0


# --------------------------------------------------------------------------- #
# Text
# --------------------------------------------------------------------------- #
def test_text_identical():
    assert text_similarity("black calculator", "black calculator") == 1.0


def test_text_survives_typos():
    assert text_similarity("scientific calculator", "scientfic calclator") > 0.8


def test_text_unrelated():
    assert text_similarity("blue water bottle", "grey hoodie") < 0.5


def test_text_empty_returns_none():
    assert text_similarity("", "anything") is None


def test_hidden_detail_fuzzy_match():
    score = hidden_detail_similarity("red dragon sticker", "a red dragon sticker on the back")
    assert score >= config.HIDDEN_DETAIL_MIN_SIMILARITY


# --------------------------------------------------------------------------- #
# Attributes
# --------------------------------------------------------------------------- #
FIELDS = [
    FieldDef(key="brand"),
    FieldDef(key="colour"),
    FieldDef(key="model"),
]


def test_attributes_all_match():
    attrs = {"brand": "Casio", "colour": "Black"}
    assert attribute_score(attrs, attrs, FIELDS) == 1.0


def test_attributes_conflict_is_penalised():
    score = attribute_score({"colour": "Red"}, {"colour": "Blue"}, FIELDS)
    assert score == 0.1


def test_attributes_missing_fields_are_skipped():
    # Only "brand" is comparable, and it matches -> 1.0 (not penalised for the rest).
    score = attribute_score({"brand": "Casio"}, {"brand": "Casio", "colour": "Black"}, FIELDS)
    assert score == 1.0


def test_attributes_nothing_to_compare():
    assert attribute_score({}, {"brand": "Casio"}, FIELDS) is None


# --------------------------------------------------------------------------- #
# Image
# --------------------------------------------------------------------------- #
def _png_bytes(array: np.ndarray) -> bytes:
    import io

    buffer = io.BytesIO()
    Image.fromarray(array).save(buffer, format="PNG")
    return buffer.getvalue()


def test_phash_is_stable_for_same_image():
    array = (np.random.default_rng(1).random((64, 64, 3)) * 255).astype("uint8")
    data = _png_bytes(array)
    assert compute_phash(data) == compute_phash(data)


def test_phash_differs_for_different_images():
    vertical = np.zeros((64, 64, 3), dtype="uint8")
    vertical[:, :32] = 255

    horizontal = np.zeros((64, 64, 3), dtype="uint8")
    horizontal[:32, :] = 255

    hash_a = compute_phash(_png_bytes(vertical))
    hash_b = compute_phash(_png_bytes(horizontal))
    assert hamming_distance(hash_a, hash_b) > 10
    assert image_similarity(hash_a, hash_b) < 0.85


def test_phash_tolerates_resizing():
    base = np.zeros((64, 64, 3), dtype="uint8")
    base[:, :32] = 255

    resized = np.asarray(Image.fromarray(base).resize((128, 128), Image.Resampling.LANCZOS))
    distance = hamming_distance(compute_phash(_png_bytes(base)), compute_phash(_png_bytes(resized)))
    assert distance <= 8


def test_image_similarity_without_hashes():
    assert image_similarity(None, "abc") is None


def test_phash_rejects_non_image():
    assert compute_phash(b"this is not an image") is None


# --------------------------------------------------------------------------- #
# Full score (the deck's calculator example)
# --------------------------------------------------------------------------- #
def _calculator_pair() -> tuple[ReportSnapshot, ReportSnapshot]:
    lost = ReportSnapshot(
        id=1,
        type="LOST",
        category_key="calculator",
        public_description="Black Casio scientific calculator with a small scratch near the display",
        attributes={"brand": "Casio", "colour": "Black", "model": "fx-991EX", "has_case": True},
        location_path="Main Block/Block B/Second Floor/Room 204",
        occurred_at=BASE,
        photo_hash=None,
        hidden_detail="Red dragon sticker on the inside of the cover",
    )
    found = ReportSnapshot(
        id=2,
        type="FOUND",
        category_key="calculator",
        public_description="Black scientific calculator, small scratch near the display",
        attributes={"brand": "Casio", "colour": "Black", "model": "fx-991EX", "has_case": True},
        location_path="Main Block/Block B/Second Floor/Room 204",
        occurred_at=BASE + timedelta(minutes=10),
        photo_hash=None,
        hidden_detail=None,
    )
    return lost, found


def test_calculator_pair_is_high_band():
    lost, found = _calculator_pair()
    result = compute_score(lost, found, [FieldDef(key="brand"), FieldDef(key="colour")])
    assert result.band == "HIGH"
    assert result.score >= config.HIGH_BAND


def test_breakdown_contains_every_signal():
    lost, found = _calculator_pair()
    result = compute_score(lost, found, [FieldDef(key="brand")])
    breakdown = result.breakdown
    assert set(breakdown["signals"]) == {"location", "time", "text", "attributes", "image"}
    assert breakdown["signals"]["image"] is None
    assert "image" in breakdown["signals_missing"]
    assert breakdown["final_score"] == result.score


def test_hidden_detail_bonus_raises_score():
    lost, found = _calculator_pair()
    found.hidden_detail = "red dragon sticker"
    with_bonus = compute_score(lost, found, [])
    without_bonus = compute_score(lost, _calculator_pair()[1], [])
    assert with_bonus.score >= without_bonus.score


def test_different_category_is_still_scored_but_low_band_drops():
    # compute_score does not filter; blocking does. This documents that.
    lost, _ = _calculator_pair()
    other = ReportSnapshot(
        id=3,
        type="FOUND",
        category_key="bottle",
        public_description="Grey hoodie",
        attributes={},
        location_path="Main Block/Sports Complex/Gym",
        occurred_at=BASE + timedelta(days=10),
        photo_hash=None,
    )
    result = compute_score(lost, other, [])
    assert result.band is None
