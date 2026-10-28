"""Catalog endpoints: categories, category fields and campus locations.

These are public (no token required) so the frontend can preload form options
before the user logs in.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.catalog import Category, CategoryField
from app.models.location import Location
from app.schemas.catalog import (
    CategoryDetail,
    CategoryFieldOut,
    CategoryOut,
    LocationNode,
    LocationOut,
)
from app.services import serializers

router = APIRouter(tags=["Catalog"])


@router.get("/categories", response_model=list[CategoryOut], summary="List item categories")
def list_categories(db: Session = Depends(get_db)) -> list[CategoryOut]:
    stmt = (
        select(Category)
        .options(selectinload(Category.fields))
        .where(Category.is_active.is_(True))
        .order_by(Category.sort_order, Category.label)
    )
    categories = db.execute(stmt).scalars().all()
    return [serializers.category_out(category) for category in categories]


@router.get(
    "/categories/{key}",
    response_model=CategoryDetail,
    summary="Category detail including its attribute schema",
)
def get_category(key: str, db: Session = Depends(get_db)) -> CategoryDetail:
    stmt = (
        select(Category)
        .options(selectinload(Category.fields))
        .where(Category.key == key)
    )
    category = db.execute(stmt).scalar_one_or_none()
    if category is None:
        raise NotFoundError(f"Category '{key}' does not exist.")
    return CategoryDetail(
        **serializers.category_out(category).model_dump(),
        fields=[CategoryFieldOut.model_validate(field) for field in category.fields],
    )


@router.get(
    "/categories/{key}/fields",
    response_model=list[CategoryFieldOut],
    summary="Attribute schema for one category (drives the dynamic form)",
)
def get_category_fields(key: str, db: Session = Depends(get_db)) -> list[CategoryField]:
    category = db.execute(select(Category).where(Category.key == key)).scalar_one_or_none()
    if category is None:
        raise NotFoundError(f"Category '{key}' does not exist.")
    stmt = (
        select(CategoryField)
        .where(CategoryField.category_id == category.id)
        .order_by(CategoryField.sort_order)
    )
    return list(db.execute(stmt).scalars().all())


@router.get("/locations", response_model=list[LocationOut], summary="Search / list locations")
def list_locations(
    parent_id: int | None = Query(default=None, description="Only direct children of this location"),
    q: str | None = Query(default=None, max_length=80, description="Case-insensitive path search"),
    db: Session = Depends(get_db),
) -> list[Location]:
    stmt = select(Location).order_by(Location.path)
    if parent_id is not None:
        stmt = stmt.where(Location.parent_id == parent_id)
    if q:
        stmt = stmt.where(Location.path.ilike(f"%{q}%"))
    return list(db.execute(stmt.limit(200)).scalars().all())


@router.get("/locations/tree", response_model=list[LocationNode], summary="Full location tree")
def location_tree(db: Session = Depends(get_db)) -> list[LocationNode]:
    locations = list(db.execute(select(Location).order_by(Location.path)).scalars().all())

    nodes: dict[int, LocationNode] = {
        location.id: LocationNode(
            id=location.id,
            name=location.name,
            type=location.type,
            parent_id=location.parent_id,
            path=location.path,
            depth=location.depth,
            children=[],
        )
        for location in locations
    }

    roots: list[LocationNode] = []
    for location in locations:
        node = nodes[location.id]
        parent = nodes.get(location.parent_id) if location.parent_id else None
        if parent is not None:
            parent.children.append(node)
        else:
            roots.append(node)
    return roots
