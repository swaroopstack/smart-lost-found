"""Audit-trail helper for admin actions."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def record(
    db: Session,
    *,
    actor_id: int | None,
    action: str,
    entity: str | None = None,
    entity_id: int | None = None,
    meta: dict | None = None,
) -> AuditLog:
    """Append an entry to the audit log (does not commit)."""
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        meta=meta or {},
    )
    db.add(entry)
    return entry
