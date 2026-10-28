"""Pagination helpers shared by every list endpoint."""

from dataclasses import dataclass
from typing import Any, Sequence

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


@dataclass(slots=True)
class PageParams:
    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def page_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
) -> PageParams:
    """FastAPI dependency producing validated pagination parameters."""
    return PageParams(page=page, page_size=page_size)


def paginate(db: Session, stmt: Select, params: PageParams) -> tuple[Sequence[Any], int]:
    """Run ``stmt`` with pagination applied and return ``(rows, total)``."""
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = db.execute(count_stmt).scalar_one()
    rows = db.execute(stmt.offset(params.offset).limit(params.limit)).scalars().all()
    return rows, total


def build_page(items: list[Any], total: int, params: PageParams) -> dict[str, Any]:
    """Build the standard paginated envelope used by every list endpoint."""
    pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": pages,
    }
