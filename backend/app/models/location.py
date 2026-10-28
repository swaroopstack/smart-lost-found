"""Hierarchical campus locations (Building > Block > Floor > Room)."""

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import LocationType


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[str] = mapped_column(
        String(20), default=LocationType.OTHER.value, nullable=False
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"), index=True
    )    #: Materialised path, e.g. ``"Main Block/Block B/Second Floor/Room 204"``.
    #: This is what the matching engine compares, so keep the separator stable.
    path: Mapped[str] = mapped_column(String(400), nullable=False, index=True)
    depth: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    parent: Mapped["Location | None"] = relationship(
        back_populates="children", remote_side="Location.id"
    )
    children: Mapped[list["Location"]] = relationship(
        back_populates="parent", cascade="all, delete-orphan", order_by="Location.name"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Location id={self.id} path={self.path!r}>"
