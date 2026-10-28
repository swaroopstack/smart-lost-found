"""User schemas."""

from pydantic import Field

from app.models.enums import Role
from app.schemas.common import ORMModel, UTCDateTime


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    roll_number: str | None = None
    role: Role
    department: str | None = None
    phone: str | None = None
    is_active: bool
    created_at: UTCDateTime


class UserBrief(ORMModel):
    """Minimal public identity, safe to show to other users."""

    id: int
    full_name: str
    role: Role
    department: str | None = None


class UserUpdateSelf(ORMModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    department: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=20)
    roll_number: str | None = Field(default=None, max_length=40)


class RoleUpdate(ORMModel):
    role: Role
