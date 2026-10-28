"""
Seed a realistic demo dataset.

Reproduces the numbers on the "Admin dashboard" slide of the project deck:

    24 lost reports | 17 found reports | 9 possible matches | 6 items returned

The numbers are *computed*, not hard-coded - they fall out of the dataset:

* 9 lost reports have a matching found report  -> 9 matches
* 15 lost reports were reported today and have no counterpart yet
* 8 found reports were handed in 25-40 days ago, before anything was lost

Usage::

    python -m scripts.seed_demo            # add demo data (skips if reports exist)
    python -m scripts.seed_demo --reset    # wipe reports/matches/claims, then reseed
"""

from __future__ import annotations

import argparse
from datetime import timedelta

from sqlalchemy import delete, func, select

from app.core.security import hash_password
from app.db.base import utcnow
from app.db.seed_base import ensure_base_data
from app.db.session import SessionLocal, create_all
from app.models.catalog import Category
from app.models.claim import Claim
from app.models.enums import ClaimStatus, MatchStatus, ReportStatus, Role
from app.models.location import Location
from app.models.match import Match
from app.models.notification import Notification
from app.models.report import ItemReport
from app.models.user import User
from app.services.matching.engine import run_matching_for_report

# --------------------------------------------------------------------------- #
# Reporters
# --------------------------------------------------------------------------- #
STUDENTS = [
    ("aarav@campus.edu", "Aarav Sharma", "24BCS12601"),
    ("diya@campus.edu", "Diya Patel", "24BCS12602"),
    ("rohan@campus.edu", "Rohan Verma", "24BCS12603"),
    ("ishita@campus.edu", "Ishita Nair", "24BCS12604"),
    ("kabir@campus.edu", "Kabir Singh", "24BCS12605"),
    ("meera@campus.edu", "Meera Iyer", "24BCS12606"),
    ("arjun@campus.edu", "Arjun Rao", "24BCS12607"),
    ("sanya@campus.edu", "Sanya Gupta", "24BCS12608"),
    ("vivaan@campus.edu", "Vivaan Joshi", "24BCS12609"),
    ("ananya@campus.edu", "Ananya Desai", "24BCS12610"),
    ("rehan@campus.edu", "Rehan Khan", "24BCS12611"),
    ("tara@campus.edu", "Tara Menon", "24BCS12612"),
]

SECURITY_DESK = "Main Block/Security Office/Main Gate Desk"

# --------------------------------------------------------------------------- #
# 9 stories that produce a match. The first three stay in the verification
# queue (matching the three rows on the deck's dashboard).
# --------------------------------------------------------------------------- #
STORIES: list[dict] = [
    {
        "category": "calculator",
        "returned": False,
        "lost": {
            "title": "Black scientific calculator",
            "desc": "Black Casio scientific calculator with a small scratch near the display.",
            "hidden": "Red dragon sticker on the inside of the cover",
            "attrs": {"brand": "Casio", "colour": "Black", "model": "fx-991EX", "has_case": True},
            "location": "Main Block/Block B/Second Floor/Room 204",
            "hours_ago": 26,
        },
        "found": {
            "title": "Scientific calculator found in Block B",
            "desc": "Black scientific calculator, small scratch near the display. Kept at the security desk.",
            "attrs": {"brand": "Casio", "colour": "Black", "model": "fx-991EX", "has_case": True},
            "location": "Main Block/Block B/Second Floor/Room 204",
            "hours_ago": 25,
        },
    },
    {
        "category": "bottle",
        "returned": False,
        "lost": {
            "title": "Blue steel water bottle",
            "desc": "Blue Milton bottle, 750 ml, flip lid. Has a scratch on the base.",
            "hidden": "Name written in black marker under the lid",
            "attrs": {"brand": "Milton", "colour": "Blue", "capacity_ml": 750, "lid_type": "Flip"},
            "location": "Main Block/Cafeteria/Seating Area",
            "hours_ago": 50,
        },
        "found": {
            "title": "Blue bottle left in the cafeteria",
            "desc": "Blue steel bottle 750 ml with a flip lid, collected from the cafeteria seating area.",
            "attrs": {"brand": "Milton", "colour": "Blue", "capacity_ml": 750, "lid_type": "Flip"},
            "location": "Main Block/Cafeteria/Seating Area",
            "hours_ago": 47,
        },
    },
    {
        "category": "keys_usb",
        "returned": False,
        "lost": {
            "title": "USB drive with two keys",
            "desc": "32 GB SanDisk pen drive on a ring with two silver keys and a blue keychain.",
            "hidden": "Blue keychain shaped like a football",
            "attrs": {"item_kind": "Both", "count": 2, "colour": "Blue", "capacity_gb": 32},
            "location": "Main Block/Lab Complex/Lab 2",
            "hours_ago": 74,
        },
        "found": {
            "title": "Pen drive and keys in Lab 2",
            "desc": "32 GB SanDisk USB on a ring with two keys, blue keychain attached.",
            "attrs": {"item_kind": "Both", "count": 2, "colour": "Blue", "capacity_gb": 32},
            "location": "Main Block/Lab Complex/Lab 2",
            "hours_ago": 72,
        },
    },
    {
        "category": "id_card",
        "returned": True,
        "lost": {
            "title": "College ID card",
            "desc": "Student ID card with a blue lanyard, lost somewhere near the library.",
            "hidden": "Name is Aarav Sharma, roll number 24BCS12601",
            "attrs": {"department": "CSE", "card_colour": "Blue"},
            "location": "Main Block/Library/Reading Hall",
            "hours_ago": 120,
        },
        "found": {
            "title": "ID card handed to the library desk",
            "desc": "Student ID card on a blue lanyard, submitted at the library issue desk.",
            "attrs": {"department": "CSE", "card_colour": "Blue"},
            "location": "Main Block/Library/Issue Desk",
            "hours_ago": 118,
        },
    },
    {
        "category": "earphones",
        "returned": True,
        "lost": {
            "title": "White wireless earbuds",
            "desc": "White boAt earbuds in a white charging case, left after the lab session.",
            "hidden": "Left earbud has a tiny crack near the mesh",
            "attrs": {"brand": "boAt", "colour": "White", "wired": False, "has_case": True},
            "location": "Main Block/Lab Complex/Lab 1",
            "hours_ago": 150,
        },
        "found": {
            "title": "Earbuds found in Lab 1",
            "desc": "White wireless earbuds with a white charging case, found on a lab bench.",
            "attrs": {"brand": "boAt", "colour": "White", "wired": False, "has_case": True},
            "location": "Main Block/Lab Complex/Lab 1",
            "hours_ago": 148,
        },
    },
    {
        "category": "books",
        "returned": True,
        "lost": {
            "title": "Data Structures textbook",
            "desc": "Blue Data Structures textbook by Cormen, name written inside the front cover.",
            "hidden": "Notes in pencil on page 112",
            "attrs": {"subject": "Data Structures", "author": "Cormen", "colour": "Blue"},
            "location": "Main Block/Block A/First Floor/Room A-201",
            "hours_ago": 180,
        },
        "found": {
            "title": "Blue textbook left in Room A-201",
            "desc": "Blue Data Structures textbook by Cormen, found after the morning lecture.",
            "attrs": {"subject": "Data Structures", "author": "Cormen", "colour": "Blue"},
            "location": "Main Block/Block A/First Floor/Room A-201",
            "hours_ago": 178,
        },
    },
    {
        "category": "calculator",
        "returned": True,
        "lost": {
            "title": "Grey calculator",
            "desc": "Grey Casio calculator without a cover, used in the maths exam.",
            "hidden": "Small white correction fluid dot on the ON button",
            "attrs": {"brand": "Casio", "colour": "Grey", "model": "fx-82MS", "has_case": False},
            "location": "Main Block/Block A/Ground Floor/Room A-102",
            "hours_ago": 210,
        },
        "found": {
            "title": "Grey calculator from exam hall",
            "desc": "Grey Casio calculator with no cover, handed in after the exam.",
            "attrs": {"brand": "Casio", "colour": "Grey", "model": "fx-82MS", "has_case": False},
            "location": "Main Block/Block A/Ground Floor/Room A-102",
            "hours_ago": 208,
        },
    },
    {
        "category": "bottle",
        "returned": True,
        "lost": {
            "title": "Black gym bottle",
            "desc": "Black 1 litre bottle with a screw lid, left near the gym entrance.",
            "hidden": "Sticker of a yellow lightning bolt",
            "attrs": {"brand": "Cello", "colour": "Black", "capacity_ml": 1000, "lid_type": "Screw"},
            "location": "Main Block/Sports Complex/Gym",
            "hours_ago": 240,
        },
        "found": {
            "title": "Black bottle near the gym",
            "desc": "Black one litre bottle with a screw lid, found outside the gym.",
            "attrs": {"brand": "Cello", "colour": "Black", "capacity_ml": 1000, "lid_type": "Screw"},
            "location": "Main Block/Sports Complex/Ground",
            "hours_ago": 236,
        },
    },
    {
        "category": "earphones",
        "returned": True,
        "lost": {
            "title": "Black wired earphones",
            "desc": "Black wired Realme earphones, cable slightly frayed near the jack.",
            "hidden": "Right earbud has a red ring",
            "attrs": {"brand": "Realme", "colour": "Black", "wired": True, "has_case": False},
            "location": "Main Block/Cafeteria/Counter",
            "hours_ago": 260,
        },
        "found": {
            "title": "Wired earphones at the cafeteria counter",
            "desc": "Black wired earphones with a slightly frayed cable, left at the counter.",
            "attrs": {"brand": "Realme", "colour": "Black", "wired": True, "has_case": False},
            "location": "Main Block/Cafeteria/Counter",
            "hours_ago": 258,
        },
    },
]

# --------------------------------------------------------------------------- #
# 15 lost reports filed *today* with no counterpart yet (found-before-lost
# filter guarantees they do not pair with anything).
# --------------------------------------------------------------------------- #
EXTRA_LOST: list[dict] = [
    ("calculator", "Casio calculator with cover", "Black Casio fx-991 with a black cover.", {"brand": "Casio", "colour": "Black", "has_case": True}, "Main Block/Block A/Ground Floor/Room A-101"),
    ("calculator", "Pink calculator", "Small pink calculator, no cover.", {"colour": "Pink", "has_case": False}, "Main Block/Block B/Second Floor/Room 205"),
    ("bottle", "Green flask", "Green 500 ml flask with a straw lid.", {"colour": "Green", "capacity_ml": 500, "lid_type": "Straw"}, "Main Block/Library/Reading Hall"),
    ("bottle", "Steel bottle with dent", "Steel bottle with a dent near the base.", {"colour": "Steel", "capacity_ml": 900}, "Main Block/Sports Complex/Ground"),
    ("earphones", "Blue neckband earphones", "Blue neckband earphones, wired.", {"colour": "Blue", "wired": True}, "Main Block/Block A/First Floor/Room A-202"),
    ("earphones", "White earbuds in a case", "White earbuds, charging case missing the lid.", {"colour": "White", "has_case": True}, "Main Block/Lab Complex/Lab 3"),
    ("books", "Operating Systems notes", "Spiral notebook with OS notes, green cover.", {"subject": "Operating Systems", "colour": "Green"}, "Main Block/Block A/Ground Floor/Room A-101"),
    ("books", "DBMS lab manual", "DBMS lab manual, red cover, name inside.", {"subject": "DBMS", "colour": "Red"}, "Main Block/Lab Complex/Lab 2"),
    ("keys_usb", "Single room key", "Single silver key with a small ring.", {"item_kind": "Keys", "count": 1, "colour": "Silver"}, "Main Block/Block B/Second Floor/Room 204"),
    ("keys_usb", "16 GB pen drive", "Black 16 GB pen drive, no cap.", {"item_kind": "USB", "capacity_gb": 16, "colour": "Black"}, "Main Block/Lab Complex/Lab 1"),
    ("id_card", "ID card with red lanyard", "ID card on a red lanyard, lost near the gate.", {"department": "ECE", "card_colour": "Red"}, "Main Block/Security Office/Main Gate Desk"),
    ("others", "Grey hoodie", "Grey hoodie, size M, left in the reading hall.", {}, "Main Block/Library/Reading Hall"),
    ("others", "Spectacle case", "Black spectacle case with a cleaning cloth.", {}, "Main Block/Cafeteria/Seating Area"),
    ("others", "Umbrella", "Blue folding umbrella with a broken rib.", {}, "Main Block/Block A/Ground Floor/Room A-102"),
    ("others", "Wrist watch", "Black analogue wrist watch with a leather strap.", {}, "Main Block/Sports Complex/Gym"),
]

# --------------------------------------------------------------------------- #
# 8 found reports handed in 25-40 days ago (before anything was lost).
# --------------------------------------------------------------------------- #
EXTRA_FOUND: list[dict] = [
    ("calculator", "Calculator from last month's exam", "Black calculator found in the exam hall last month.", {"colour": "Black"}, "Main Block/Block A/Ground Floor/Room A-101", 28),
    ("bottle", "Old steel bottle", "Steel bottle left in the reading hall weeks ago.", {"colour": "Steel"}, "Main Block/Library/Reading Hall", 31),
    ("earphones", "Earphones from the lab", "White earphones found under a lab bench.", {"colour": "White"}, "Main Block/Lab Complex/Lab 3", 33),
    ("books", "Unclaimed notebook", "Blue notebook with no name, found in Room A-202.", {"colour": "Blue"}, "Main Block/Block A/First Floor/Room A-202", 35),
    ("keys_usb", "Lone key on a ring", "Single key on a steel ring, handed to security.", {"item_kind": "Keys", "count": 1, "colour": "Silver"}, SECURITY_DESK, 27),
    ("id_card", "ID card without a lanyard", "Student ID card with no lanyard, found near the counter.", {"card_colour": "Green"}, "Main Block/Cafeteria/Counter", 38),
    ("others", "Blue umbrella", "Blue umbrella left at the gate desk.", {}, SECURITY_DESK, 40),
    ("others", "Black cap", "Black cap found on the ground.", {}, "Main Block/Sports Complex/Ground", 29),
]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _ensure_students(db) -> list[User]:
    users: list[User] = []
    for email, name, roll in STUDENTS:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            user = User(
                email=email,
                hashed_password=hash_password("Student@123"),
                full_name=name,
                roll_number=roll,
                role=Role.STUDENT.value,
                department="CSE",
                is_active=True,
            )
            db.add(user)
            db.flush()
        users.append(user)
    db.commit()
    return users


def _location_ids(db) -> dict[str, int]:
    rows = db.execute(select(Location.id, Location.path)).all()
    return {path: location_id for location_id, path in rows}


def _category_ids(db) -> dict[str, int]:
    rows = db.execute(select(Category.id, Category.key)).all()
    return {key: category_id for category_id, key in rows}


def _make_report(db, *, reporter_id, category_id, location_id, spec, report_type, occurred_at, deposited_id=None):
    report = ItemReport(
        reporter_id=reporter_id,
        type=report_type,
        category_id=category_id,
        title=spec["title"],
        public_description=spec.get("desc"),
        hidden_detail=spec.get("hidden"),
        attributes=spec.get("attrs", {}),
        location_id=location_id,
        occurred_at=occurred_at,
        status=ReportStatus.OPEN.value,
        deposited_location_id=deposited_id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    run_matching_for_report(db, report, notify=False)
    db.commit()
    db.refresh(report)
    return report


def main(reset: bool = False) -> None:
    create_all()

    with SessionLocal() as db:
        ensure_base_data(db)

        if reset:
            db.execute(delete(Claim))
            db.execute(delete(Match))
            db.execute(delete(Notification))
            db.execute(delete(ItemReport))
            db.commit()
        elif db.execute(select(func.count(ItemReport.id))).scalar_one() > 0:
            print("Reports already exist - use --reset to wipe and reseed.")
            return

        students = _ensure_students(db)
        locations = _location_ids(db)
        categories = _category_ids(db)
        now = utcnow()

        # 1) The 9 story pairs: LOST first, then FOUND (matching runs on create).
        pairs: list[tuple[int, int, bool]] = []
        for index, story in enumerate(STORIES):
            reporter = students[index % len(students)]
            finder = students[(index + 5) % len(students)]

            lost_spec = story["lost"]
            lost = _make_report(
                db,
                reporter_id=reporter.id,
                category_id=categories[story["category"]],
                location_id=locations[lost_spec["location"]],
                spec=lost_spec,
                report_type="LOST",
                occurred_at=now - timedelta(hours=lost_spec["hours_ago"]),
            )

            found_spec = story["found"]
            found = _make_report(
                db,
                reporter_id=finder.id,
                category_id=categories[story["category"]],
                location_id=locations[found_spec["location"]],
                spec=found_spec,
                report_type="FOUND",
                occurred_at=now - timedelta(hours=found_spec["hours_ago"]),
                deposited_id=locations[SECURITY_DESK],
            )
            pairs.append((lost.id, found.id, story["returned"]))

        # 2) 15 extra lost reports filed today (no counterpart yet).
        for index, (category, title, desc, attrs, location_path) in enumerate(EXTRA_LOST):
            reporter = students[(index + 2) % len(students)]
            _make_report(
                db,
                reporter_id=reporter.id,
                category_id=categories[category],
                location_id=locations[location_path],
                spec={"title": title, "desc": desc, "attrs": attrs},
                report_type="LOST",
                occurred_at=now - timedelta(hours=1 + index % 8),
            )

        # 3) 8 extra found reports from 25-40 days ago.
        for index, (category, title, desc, attrs, location_path, days) in enumerate(EXTRA_FOUND):
            finder = students[(index + 7) % len(students)]
            _make_report(
                db,
                reporter_id=finder.id,
                category_id=categories[category],
                location_id=locations[location_path],
                spec={"title": title, "desc": desc, "attrs": attrs},
                report_type="FOUND",
                occurred_at=now - timedelta(days=days),
                deposited_id=locations[SECURITY_DESK],
            )

        # 4) Resolve the 6 stories that were already returned.
        for lost_id, found_id, returned in pairs:
            match = db.execute(
                select(Match).where(
                    Match.lost_report_id == lost_id, Match.found_report_id == found_id
                )
            ).scalar_one_or_none()
            if match is None:
                print(f"  ! no match produced for pair {lost_id}/{found_id}")
                continue
            if not returned:
                continue

            match.status = MatchStatus.CONFIRMED.value
            match.reviewed_at = now
            lost_report = db.get(ItemReport, lost_id)
            found_report = db.get(ItemReport, found_id)
            lost_report.status = ReportStatus.RETURNED.value
            lost_report.closed_at = now
            found_report.status = ReportStatus.RETURNED.value
            found_report.closed_at = now

            db.add(
                Claim(
                    match_id=match.id,
                    claimant_id=lost_report.reporter_id,
                    answers={"hidden_detail": "verified at the security desk"},
                    status=ClaimStatus.APPROVED.value,
                    decided_at=now,
                    notes="Seeded demo claim.",
                )
            )
        db.commit()

        # 5) Summary
        lost_count = db.execute(
            select(func.count(ItemReport.id)).where(ItemReport.type == "LOST")
        ).scalar_one()
        found_count = db.execute(
            select(func.count(ItemReport.id)).where(ItemReport.type == "FOUND")
        ).scalar_one()
        match_count = db.execute(select(func.count(Match.id))).scalar_one()
        returned = db.execute(
            select(func.count(Claim.id)).where(Claim.status == ClaimStatus.APPROVED.value)
        ).scalar_one()

        print("Demo data seeded")
        print(f"  lost reports     : {lost_count}")
        print(f"  found reports    : {found_count}")
        print(f"  possible matches : {match_count}")
        print(f"  items returned   : {returned}")
        print("  login: admin@campus.edu / Admin@123")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed demo data for Smart Lost & Found")
    parser.add_argument("--reset", action="store_true", help="delete reports, matches and claims first")
    args = parser.parse_args()
    main(reset=args.reset)
