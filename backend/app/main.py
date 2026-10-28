"""
FastAPI application entry point.

Run locally with::

    uvicorn app.main:app --reload

Interactive docs:  http://127.0.0.1:8000/docs
OpenAPI schema :  http://127.0.0.1:8000/openapi.json
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.db.seed_base import ensure_base_data
from app.db.session import SessionLocal, create_all, engine

logger = logging.getLogger("slf")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auto_create_tables and not settings.is_test:
        create_all()
        if settings.auto_seed_base:
            with SessionLocal() as db:
                created = ensure_base_data(db)
                if any(created.values()):
                    logger.info("Base data seeded: %s", created)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "Backend for a campus **Smart Lost & Found** system.\n\n"
        "Flow: `LOST report` + `FOUND report` -> **automatic scoring** -> "
        "admin verification -> **claim approved** -> item returned.\n\n"
        "See `README.md` for the full data model, matching formulas and "
        "frontend integration notes."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# --------------------------------------------------------------------------- #
# Middleware
# --------------------------------------------------------------------------- #
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

register_exception_handlers(app)

# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
app.include_router(api_router, prefix=settings.api_v1_prefix)

# Uploaded images are served from /media/<path>
_upload_dir = Path(settings.upload_dir)
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount(settings.media_url_prefix, StaticFiles(directory=str(_upload_dir)), name="media")


@app.get("/", tags=["Meta"], summary="Service banner")
def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.version,
        "docs": "/docs",
        "api": settings.api_v1_prefix,
    }


@app.get("/health", tags=["Meta"], summary="Liveness + database check")
def health() -> dict:
    database_ok = True
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:  # pragma: no cover - only hit when the DB is unreachable
        database_ok = False
    return {
        "status": "ok" if database_ok else "degraded",
        "version": settings.version,
        "database": "ok" if database_ok else "unavailable",
    }
