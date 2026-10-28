"""
Idempotent base data: categories, category attribute schemas, the campus
location tree and the three demo accounts.

Safe to call on every startup - it only inserts when the relevant table is
empty.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.catalog import Category, CategoryField
from app.models.enums import FieldType, LocationType, Role
from app.models.location import Location
from app.models.user import User

# --------------------------------------------------------------------------- #
# Categories
# --------------------------------------------------------------------------- #
_DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "MBA", "Other"]

CATEGORIES: list[dict] = [
    {
        "key": "id_card",
        "label": "ID Card",
        "icon": "id-card",
        "description": "College identity card",
        "fields": [
            {"key": "holder_name", "label": "Name printed on card", "type": FieldType.TEXT, "is_hidden": True},
            {"key": "roll_number", "label": "Roll number", "type": FieldType.TEXT, "is_hidden": True},
            {"key": "department", "label": "Department", "type": FieldType.SELECT, "options": _DEPARTMENTS},
            {"key": "card_colour", "label": "Card colour", "type": FieldType.SELECT, "options": ["Blue", "Green", "Red", "Other"]},
        ],
    },
    {
        "key": "calculator",
        "label": "Calculator",
        "icon": "calculator",
        "description": "Scientific or simple calculator",
        "fields": [
            {"key": "brand", "label": "Brand", "type": FieldType.TEXT, "placeholder": "Casio, FX, ..."},
            {"key": "colour", "label": "Colour", "type": FieldType.SELECT, "options": ["Black", "White", "Grey", "Blue", "Pink", "Other"]},
            {"key": "model", "label": "Model", "type": FieldType.TEXT, "placeholder": "fx-991EX"},
            {"key": "has_case", "label": "Has a cover / case", "type": FieldType.BOOL},
        ],
    },
    {
        "key": "bottle",
        "label": "Bottle",
        "icon": "bottle",
        "description": "Water bottle / flask",
        "fields": [
            {"key": "brand", "label": "Brand", "type": FieldType.TEXT, "placeholder": "Milton, Cello, ..."},
            {"key": "colour", "label": "Colour", "type": FieldType.SELECT, "options": ["Black", "Blue", "Red", "Green", "Pink", "Steel", "Other"]},
            {"key": "capacity_ml", "label": "Capacity (ml)", "type": FieldType.NUMBER},
            {"key": "lid_type", "label": "Lid type", "type": FieldType.SELECT, "options": ["Flip", "Screw", "Straw", "Other"]},
        ],
    },
    {
        "key": "earphones",
        "label": "Earphones",
        "icon": "headphones",
        "description": "Wired or wireless earphones / earbuds",
        "fields": [
            {"key": "brand", "label": "Brand", "type": FieldType.TEXT, "placeholder": "boAt, Realme, ..."},
            {"key": "colour", "label": "Colour", "type": FieldType.SELECT, "options": ["Black", "White", "Blue", "Other"]},
            {"key": "wired", "label": "Wired", "type": FieldType.BOOL},
            {"key": "has_case", "label": "Has a charging case", "type": FieldType.BOOL},
        ],
    },
    {
        "key": "books",
        "label": "Books / Notes",
        "icon": "book",
        "description": "Textbooks, notebooks, lab manuals",
        "fields": [
            {"key": "subject", "label": "Subject", "type": FieldType.TEXT},
            {"key": "author", "label": "Author", "type": FieldType.TEXT},
            {"key": "colour", "label": "Cover colour", "type": FieldType.SELECT, "options": ["Black", "Blue", "Red", "Green", "Yellow", "Other"]},
        ],
    },
    {
        "key": "keys_usb",
        "label": "Keys / USB",
        "icon": "key",
        "description": "Keys, keychains, pen drives",
        "fields": [
            {"key": "item_kind", "label": "Item", "type": FieldType.SELECT, "options": ["Keys", "USB", "Both"]},
            {"key": "count", "label": "How many keys", "type": FieldType.NUMBER},
            {"key": "colour", "label": "Colour / keychain", "type": FieldType.SELECT, "options": ["Black", "Blue", "Red", "Green", "Silver", "Other"]},
            {"key": "capacity_gb", "label": "USB capacity (GB)", "type": FieldType.NUMBER},
        ],
    },
    {
        "key": "others",
        "label": "Other",
        "icon": "box",
        "description": "Anything else",
        "fields": [],
    },
]

# --------------------------------------------------------------------------- #
# Location tree: (name, type, parent_path)
# --------------------------------------------------------------------------- #
LOCATIONS: list[tuple[str, str, str | None]] = [
    ("Main Block", LocationType.BUILDING.value, None),
    ("Block A", LocationType.BLOCK.value, "Main Block"),
    ("Ground Floor", LocationType.FLOOR.value, "Main Block/Block A"),
    ("Room A-101", LocationType.ROOM.value, "Main Block/Block A/Ground Floor"),
    ("Room A-102", LocationType.ROOM.value, "Main Block/Block A/Ground Floor"),
    ("First Floor", LocationType.FLOOR.value, "Main Block/Block A"),
    ("Room A-201", LocationType.ROOM.value, "Main Block/Block A/First Floor"),
    ("Room A-202", LocationType.ROOM.value, "Main Block/Block A/First Floor"),
    ("Block B", LocationType.BLOCK.value, "Main Block"),
    ("Second Floor", LocationType.FLOOR.value, "Main Block/Block B"),
    ("Room 204", LocationType.ROOM.value, "Main Block/Block B/Second Floor"),
    ("Room 205", LocationType.ROOM.value, "Main Block/Block B/Second Floor"),
    ("Library", LocationType.BLOCK.value, "Main Block"),
    ("Reading Hall", LocationType.ROOM.value, "Main Block/Library"),
    ("Issue Desk", LocationType.ROOM.value, "Main Block/Library"),
    ("Cafeteria", LocationType.BLOCK.value, "Main Block"),
    ("Seating Area", LocationType.ROOM.value, "Main Block/Cafeteria"),
    ("Counter", LocationType.ROOM.value, "Main Block/Cafeteria"),
    ("Lab Complex", LocationType.BLOCK.value, "Main Block"),
    ("Lab 1", LocationType.ROOM.value, "Main Block/Lab Complex"),
    ("Lab 2", LocationType.ROOM.value, "Main Block/Lab Complex"),
    ("Lab 3", LocationType.ROOM.value, "Main Block/Lab Complex"),
    ("Sports Complex", LocationType.BLOCK.value, "Main Block"),
    ("Ground", LocationType.ROOM.value, "Main Block/Sports Complex"),
    ("Gym", LocationType.ROOM.value, "Main Block/Sports Complex"),
    ("Security Office", LocationType.BLOCK.value, "Main Block"),
    ("Main Gate Desk", LocationType.ROOM.value, "Main Block/Security Office"),
]

# --------------------------------------------------------------------------- #
# Demo accounts (password is documented in README.md)
# --------------------------------------------------------------------------- #
DEMO_USERS: list[dict] = [
    {
        "email": "admin@campus.edu",
        "password": "Admin@123",
        "full_name": "Campus Admin",
        "role": Role.ADMIN.value,
        "department": "Administration",
    },
    {
        "email": "staff@campus.edu",
        "password": "Staff@123",
        "full_name": "Security Desk Staff",
        "role": Role.STAFF.value,
        "department": "Security",
    },
    {
        "email": "student@campus.edu",
        "password": "Student@123",
        "full_name": "Demo Student",
        "roll_number": "24BCS00001",
        "role": Role.STUDENT.value,
        "department": "CSE",
    },
]


def _is_empty(db: Session, model) -> bool:
    return db.execute(select(func.count()).select_from(model)).scalar_one() == 0


def ensure_base_data(db: Session) -> dict[str, int]:
    """Insert the base catalog, locations and demo users if they are missing."""
    created = {"categories": 0, "locations": 0, "users": 0}

    if _is_empty(db, Category):
        for order, spec in enumerate(CATEGORIES):
            category = Category(
                key=spec["key"],
                label=spec["label"],
                icon=spec.get("icon"),
                description=spec.get("description"),
                sort_order=order,
                is_active=True,
            )
            db.add(category)
            db.flush()
            for field_order, field in enumerate(spec.get("fields", [])):
                db.add(
                    CategoryField(
                        category_id=category.id,
                        key=field["key"],
                        label=field["label"],
                        type=field["type"].value if hasattr(field["type"], "value") else field["type"],
                        options=field.get("options"),
                        placeholder=field.get("placeholder"),
                        is_required=field.get("is_required", False),
                        is_hidden=field.get("is_hidden", False),
                        sort_order=field_order,
                    )
                )
            created["categories"] += 1

    if _is_empty(db, Location):
        by_path: dict[str, Location] = {}
        for name, location_type, parent_path in LOCATIONS:
            path = f"{parent_path}/{name}" if parent_path else name
            location = Location(
                name=name,
                type=location_type,
                parent_id=by_path[parent_path].id if parent_path else None,
                path=path,
                depth=path.count("/"),
            )
            db.add(location)
            db.flush()
            by_path[path] = location
            created["locations"] += 1

    if _is_empty(db, User):
        for spec in DEMO_USERS:
            db.add(
                User(
                    email=spec["email"],
                    hashed_password=hash_password(spec["password"]),
                    full_name=spec["full_name"],
                    roll_number=spec.get("roll_number"),
                    role=spec["role"],
                    department=spec.get("department"),
                    is_active=True,
                )
            )
            created["users"] += 1

    db.commit()
    return created
