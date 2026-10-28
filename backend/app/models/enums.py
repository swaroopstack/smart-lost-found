"""Enumerations used across models, schemas and services.

These are stored in the database as plain strings (``String(20)``) so the same
code runs on SQLite and PostgreSQL without migration pain.
"""

from enum import Enum


class Role(str, Enum):
    STUDENT = "STUDENT"
    STAFF = "STAFF"
    ADMIN = "ADMIN"


class ReportType(str, Enum):
    LOST = "LOST"
    FOUND = "FOUND"


class ReportStatus(str, Enum):
    """Lifecycle of a report.

    LOST :  OPEN -> MATCHED -> CLAIMED -> RETURNED
    FOUND:  OPEN -> MATCHED -> HANDED_OVER -> RETURNED
    Any    -> CLOSED | EXPIRED
    """

    OPEN = "OPEN"
    MATCHED = "MATCHED"
    CLAIMED = "CLAIMED"
    HANDED_OVER = "HANDED_OVER"
    RETURNED = "RETURNED"
    CLOSED = "CLOSED"
    EXPIRED = "EXPIRED"


class MatchBand(str, Enum):
    HIGH = "HIGH"      # score >= HIGH_BAND  -> notify users, queue for approval
    MEDIUM = "MEDIUM"  # MEDIUM_BAND <= score < HIGH_BAND -> admin queue only


class MatchStatus(str, Enum):
    SUGGESTED = "SUGGESTED"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"


class ClaimStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class LocationType(str, Enum):
    BUILDING = "BUILDING"
    BLOCK = "BLOCK"
    FLOOR = "FLOOR"
    ROOM = "ROOM"
    OTHER = "OTHER"


class FieldType(str, Enum):
    TEXT = "TEXT"
    SELECT = "SELECT"
    NUMBER = "NUMBER"
    BOOL = "BOOL"


class NotificationType(str, Enum):
    MATCH_FOUND = "MATCH_FOUND"
    CLAIM_SUBMITTED = "CLAIM_SUBMITTED"
    CLAIM_APPROVED = "CLAIM_APPROVED"
    CLAIM_REJECTED = "CLAIM_REJECTED"
    REPORT_CLOSED = "REPORT_CLOSED"
    SYSTEM = "SYSTEM"
