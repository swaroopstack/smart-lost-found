"""End-to-end API tests: auth, reports, matching, privacy and the claim flow."""

from datetime import datetime, timedelta, timezone

import pytest

from tests.conftest import auth, login

CALC_LOST = {
    "type": "LOST",
    "category_key": "calculator",
    "title": "Black scientific calculator",
    "public_description": "Black Casio calculator with a scratch near the display.",
    "hidden_detail": "Red dragon sticker inside the cover",
    "attributes": {"brand": "Casio", "colour": "Black", "model": "fx-991EX", "has_case": True},
    "location_id": None,
    "occurred_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
}

CALC_FOUND = {
    "type": "FOUND",
    "category_key": "calculator",
    "title": "Calculator found in Block B",
    "public_description": "Black Casio calculator, small scratch near the display.",
    "attributes": {"brand": "Casio", "colour": "Black", "model": "fx-991EX", "has_case": True},
    "location_id": None,
    "occurred_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
}


def _register(client, email: str, name: str) -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Passw0rd!", "full_name": name},
    )
    assert response.status_code == 201, response.text
    return login(client, email, "Passw0rd!")


@pytest.fixture()
def admin_token(client) -> str:
    return login(client, "admin@campus.edu", "Admin@123")


@pytest.fixture()
def student_token(client) -> str:
    return login(client, "student@campus.edu", "Student@123")


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
def test_login_returns_token_and_user(client):
    token = login(client, "admin@campus.edu", "Admin@123")
    assert token

    response = client.get("/api/v1/auth/me", headers=auth(token))
    assert response.status_code == 200
    assert response.json()["role"] == "ADMIN"


def test_login_with_wrong_password_is_401(client):
    response = client.post(
        "/api/v1/auth/login/json",
        json={"email": "admin@campus.edu", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "UNAUTHORIZED"


def test_register_duplicate_email_is_409(client):
    payload = {"email": "dupe@campus.edu", "password": "Passw0rd!", "full_name": "Dupe User"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    second = client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409
    assert second.json()["detail"]["fields"]["email"] == "Already registered"


def test_self_registration_cannot_create_admin(client):
    token = _register(client, "sneaky@campus.edu", "Sneaky Student")
    me = client.get("/api/v1/auth/me", headers=auth(token)).json()
    assert me["role"] == "STUDENT"


def test_protected_endpoint_without_token_is_401(client):
    response = client.get("/api/v1/reports")
    assert response.status_code == 401


# --------------------------------------------------------------------------- #
# Catalog
# --------------------------------------------------------------------------- #
def test_catalog_is_public(client):
    categories = client.get("/api/v1/categories")
    assert categories.status_code == 200
    assert len(categories.json()) == 7

    tree = client.get("/api/v1/locations/tree")
    assert tree.status_code == 200
    assert tree.json()[0]["path"] == "Main Block"


def test_category_exposes_form_schema(client):
    response = client.get("/api/v1/categories/calculator")
    assert response.status_code == 200
    keys = {field["key"] for field in response.json()["fields"]}
    assert {"brand", "colour", "model", "has_case"} <= keys


# --------------------------------------------------------------------------- #
# Reports + matching
# --------------------------------------------------------------------------- #
def test_report_creation_triggers_a_match(client):
    owner = _register(client, "owner@campus.edu", "Owner One")
    finder = _register(client, "finder@campus.edu", "Finder Two")

    lost = client.post("/api/v1/reports", json=CALC_LOST, headers=auth(owner))
    assert lost.status_code == 201, lost.text
    lost_id = lost.json()["id"]

    found = client.post("/api/v1/reports", json=CALC_FOUND, headers=auth(finder))
    assert found.status_code == 201, found.text
    found_id = found.json()["id"]

    matches = client.get(f"/api/v1/reports/{lost_id}/matches", headers=auth(owner))
    assert matches.status_code == 200, matches.text
    payload = matches.json()
    assert len(payload) == 1
    assert payload[0]["score"] >= 65
    assert payload[0]["found_report"]["id"] == found_id


def test_hidden_detail_never_leaks(client):
    owner = _register(client, "secret@campus.edu", "Secret Owner")
    other = _register(client, "nosy@campus.edu", "Nosy Person")

    lost = client.post("/api/v1/reports", json=CALC_LOST, headers=auth(owner))
    report_id = lost.json()["id"]

    # Another student must not see the hidden detail anywhere in the payload.
    response = client.get(f"/api/v1/reports/{report_id}", headers=auth(other))
    body = response.text
    assert "Red dragon sticker" not in body
    assert "hidden_detail" not in response.json()
    assert response.json()["has_hidden_detail"] is True

    # The owner can see it via hidden_attributes only when the category marks
    # a field as hidden; free-text hidden_detail stays server-side by design.
    mine = client.get(f"/api/v1/reports/{report_id}", headers=auth(owner))
    assert mine.json()["is_mine"] is True


def test_report_requires_valid_category(client):
    token = _register(client, "badcat@campus.edu", "Bad Cat")
    payload = dict(CALC_LOST, category_key="does_not_exist")
    response = client.post("/api/v1/reports", json=payload, headers=auth(token))
    assert response.status_code == 404


def test_report_rejects_unknown_attribute(client):
    token = _register(client, "badattr@campus.edu", "Bad Attr")
    payload = dict(CALC_LOST, attributes={"nonsense": "value"})
    response = client.post("/api/v1/reports", json=payload, headers=auth(token))
    assert response.status_code == 422
    assert "nonsense" in response.json()["detail"]["fields"]


def test_list_reports_filters_by_type(client):
    token = _register(client, "lister@campus.edu", "Lister")
    client.post("/api/v1/reports", json=CALC_LOST, headers=auth(token))
    client.post("/api/v1/reports", json=CALC_FOUND, headers=auth(token))

    lost_only = client.get("/api/v1/reports?type=LOST", headers=auth(token)).json()
    assert lost_only["total"] == 1
    assert lost_only["items"][0]["type"] == "LOST"


# --------------------------------------------------------------------------- #
# Admin + claim flow
# --------------------------------------------------------------------------- #
def test_full_claim_flow(client, admin_token):
    owner = _register(client, "claimant@campus.edu", "Claimant")
    finder = _register(client, "handover@campus.edu", "Handover")

    lost_id = client.post("/api/v1/reports", json=CALC_LOST, headers=auth(owner)).json()["id"]
    client.post("/api/v1/reports", json=CALC_FOUND, headers=auth(finder))

    match = client.get(f"/api/v1/reports/{lost_id}/matches", headers=auth(owner)).json()[0]
    match_id = match["id"]

    # Admin sees the score breakdown; students do not.
    admin_match = client.get(f"/api/v1/admin/matches/{match_id}", headers=auth(admin_token))
    assert admin_match.status_code == 200
    assert "signals" in admin_match.json()["score_breakdown"]

    # Student claims ownership.
    claim = client.post(
        "/api/v1/claims",
        json={"match_id": match_id, "answers": {"hidden_detail": "red dragon sticker"}},
        headers=auth(owner),
    )
    assert claim.status_code == 201, claim.text
    claim_id = claim.json()["id"]

    # Admin approves -> both reports become RETURNED.
    approved = client.post(f"/api/v1/admin/claims/{claim_id}/approve", headers=auth(admin_token))
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "APPROVED"

    detail = client.get(f"/api/v1/reports/{lost_id}", headers=auth(owner)).json()
    assert detail["status"] == "RETURNED"


def test_student_cannot_access_admin_endpoints(client, student_token):
    assert client.get("/api/v1/admin/matches", headers=auth(student_token)).status_code == 403
    assert client.get("/api/v1/admin/stats/today", headers=auth(student_token)).status_code == 403


def test_admin_stats_shape(client, admin_token):
    response = client.get("/api/v1/admin/stats/today", headers=auth(admin_token))
    assert response.status_code == 200
    body = response.json()
    for key in (
        "date",
        "lost_reports",
        "found_reports",
        "possible_matches",
        "items_returned",
        "pending_claims",
        "open_reports",
    ):
        assert key in body


def test_notifications_are_created_for_high_band_matches(client):
    owner = _register(client, "notif1@campus.edu", "Notif One")
    finder = _register(client, "notif2@campus.edu", "Notif Two")

    client.post("/api/v1/reports", json=CALC_LOST, headers=auth(owner))
    client.post("/api/v1/reports", json=CALC_FOUND, headers=auth(finder))

    notifications = client.get("/api/v1/notifications", headers=auth(owner)).json()
    assert notifications["total"] >= 1
    assert notifications["items"][0]["type"] == "MATCH_FOUND"


def test_meta_exposes_matching_config(client):
    body = client.get("/api/v1/meta").json()
    assert body["matching"]["thresholds"]["high_band"] == 85
    assert set(body["matching"]["default_weights"]) == {
        "location",
        "time",
        "text",
        "attributes",
        "image",
    }


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"
