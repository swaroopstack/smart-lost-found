"""v1 API router assembly."""

from fastapi import APIRouter

from app.api.v1 import admin, auth, catalog, claims, matches, meta, notifications, reports

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(reports.router)
api_router.include_router(claims.router)
api_router.include_router(notifications.router)
api_router.include_router(matches.router)
api_router.include_router(claims.admin_router)
api_router.include_router(admin.router)
api_router.include_router(meta.router)
