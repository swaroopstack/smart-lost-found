"""API metadata: version, limits and the live matching configuration."""

from fastapi import APIRouter

from app.core.config import settings
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
from app.services.matching import config as matching_config

router = APIRouter(tags=["Meta"])


@router.get("/meta", summary="API + matching configuration (used by the frontend)")
def meta() -> dict:
    return {
        "app": settings.app_name,
        "version": settings.version,
        "environment": settings.environment,
        "api_prefix": settings.api_v1_prefix,
        "docs_url": "/docs",
        "openapi_url": "/openapi.json",
        "matching": matching_config.as_public_dict(),
        "uploads": {
            "max_upload_mb": settings.max_upload_mb,
            "allowed_types": settings.allowed_image_type_list,
            "media_prefix": settings.media_url_prefix,
        },
        "enums": {
            "roles": [item.value for item in Role],
            "report_types": [item.value for item in ReportType],
            "report_statuses": [item.value for item in ReportStatus],
            "match_bands": [item.value for item in MatchBand],
            "match_statuses": [item.value for item in MatchStatus],
            "claim_statuses": [item.value for item in ClaimStatus],
            "location_types": [item.value for item in LocationType],
            "field_types": [item.value for item in FieldType],
            "notification_types": [item.value for item in NotificationType],
        },
    }
