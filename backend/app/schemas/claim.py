"""Claim schemas."""

from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import ClaimStatus
from app.schemas.common import UTCDateTime
from app.schemas.user import UserBrief


class ClaimCreate(BaseModel):
    match_id: int
    #: Free-form answers to the verification questions.
    #: Convention: ``{"hidden_detail": "...", "questions": [{"q": "...", "a": "..."}]}``
    answers: dict[str, Any] = Field(default_factory=dict)


class ClaimOut(BaseModel):
    id: int
    match_id: int
    claimant: UserBrief
    status: ClaimStatus
    notes: str | None = None
    created_at: UTCDateTime
    decided_at: UTCDateTime | None = None


class ClaimDetail(ClaimOut):
    answers: dict[str, Any] = Field(default_factory=dict)
    decided_by: int | None = None


class ClaimDecisionIn(BaseModel):
    notes: str | None = Field(default=None, max_length=1000)
