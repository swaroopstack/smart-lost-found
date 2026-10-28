"""SQLAlchemy models. Importing this package registers every table on ``Base``."""

from app.models.audit import AuditLog
from app.models.catalog import Category, CategoryField
from app.models.claim import Claim
from app.models.enums import (
    ClaimStatus,
    FieldType,
    LocationType,
    MatchBand,
    MatchStatus,
    NotificationType,
    ReportStatus,
    ReportType,
    Role,
)
from app.models.location import Location
from app.models.match import Match
from app.models.notification import Notification
from app.models.report import ItemReport
from app.models.user import User

__all__ = [
    "AuditLog",
    "Category",
    "CategoryField",
    "Claim",
    "ClaimStatus",
    "FieldType",
    "ItemReport",
    "Location",
    "LocationType",
    "Match",
    "MatchBand",
    "MatchStatus",
    "Notification",
    "NotificationType",
    "ReportStatus",
    "ReportType",
    "Role",
    "User",
]
