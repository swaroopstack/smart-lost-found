"""Item categories and their per-category attribute definitions."""

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base
from app.models.enums import FieldType


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(40))
    description: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    fields: Mapped[list["CategoryField"]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="CategoryField.sort_order",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Category {self.key!r}>"


class CategoryField(Base):
    """A structured attribute for one category.

    ``is_hidden`` marks a *verification* field: its value is never shown to
    anybody except the report owner and admins. It is used both as a matching
    signal and as the question a claimant must answer.
    """

    __tablename__ = "category_fields"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    key: Mapped[str] = mapped_column(String(40), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    type: Mapped[str] = mapped_column(String(20), default=FieldType.TEXT.value, nullable=False)
    options: Mapped[list[str] | None] = mapped_column(JSON)
    placeholder: Mapped[str | None] = mapped_column(String(120))
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    category: Mapped["Category"] = relationship(back_populates="fields")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CategoryField {self.key!r} hidden={self.is_hidden}>"
