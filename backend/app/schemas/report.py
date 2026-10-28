"""Report schemas.

Privacy contract enforced by these models:

* ``hidden_detail`` is **never** part of any response schema.
* Hidden category attributes are only present in ``ReportDetail.hidden_attributes``
  and that dict is empty unless the viewer is the report owner or an admin.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ReportStatus, ReportType
from app.schemas.catalog import CategoryOut, LocationOut
from app.schemas.common import ORMModel, UTCDateTime


class ReportCreate(BaseModel):
    type: ReportType
    category_key: str = Field(min_length=2, max_length=40)
    title: str = Field(min_length=3, max_length=140)
    public_description: str | None = Field(default=None, max_length=2000)
    #: Secret detail, used for verification and as a matching signal.
    hidden_detail: str | None = Field(default=None, max_length=500)
    attributes: dict[str, Any] = Field(default_factory=dict)
    location_id: int | None = None
    occurred_at: datetime
    #: FOUND reports only - where the item was handed in.
    deposited_location_id: int | None = None

    @field_validator("attributes")
    @classmethod
    def _limit_attributes(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(value) > 20:
            raise ValueError("At most 20 attributes are allowed")
        return value


class ReportUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=140)
    public_description: str | None = Field(default=None, max_length=2000)
    hidden_detail: str | None = Field(default=None, max_length=500)
    attributes: dict[str, Any] | None = None
    location_id: int | None = None
    occurred_at: datetime | None = None
    deposited_location_id: int | None = None


class ReportPublic(ORMModel):
    """Safe for any authenticated user."""

    id: int
    type: ReportType
    category: CategoryOut
    title: str
    public_description: str | None = None
    location: LocationOut | None = None
    occurred_at: UTCDateTime
    status: ReportStatus
    photo_url: str | None = None
    reporter_id: int
    reporter_name: str | None = None
    is_mine: bool = False
    has_hidden_detail: bool = False
    created_at: UTCDateTime


class ReportDetail(ReportPublic):
    """Adds owner/admin-only information."""

    attributes: dict[str, Any] = Field(default_factory=dict)
    hidden_attributes: dict[str, Any] = Field(default_factory=dict)
    deposited_location: LocationOut | None = None
    admin_note: str | None = None
    matches_count: int = 0
    updated_at: UTCDateTime


class ReportCloseIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
