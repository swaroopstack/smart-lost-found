"""Catalog schemas: categories, category fields, locations."""

from pydantic import Field

from app.models.enums import FieldType, LocationType
from app.schemas.common import ORMModel


class CategoryFieldOut(ORMModel):
    id: int
    key: str
    label: str
    type: FieldType
    options: list[str] | None = None
    placeholder: str | None = None
    is_required: bool
    is_hidden: bool
    sort_order: int


class CategoryOut(ORMModel):
    id: int
    key: str
    label: str
    icon: str | None = None
    description: str | None = None
    is_active: bool
    sort_order: int
    field_count: int = 0


class CategoryDetail(CategoryOut):
    fields: list[CategoryFieldOut] = Field(default_factory=list)


class LocationOut(ORMModel):
    id: int
    name: str
    type: LocationType
    parent_id: int | None = None
    path: str
    depth: int


class LocationNode(LocationOut):
    children: list["LocationNode"] = Field(default_factory=list)


LocationNode.model_rebuild()
