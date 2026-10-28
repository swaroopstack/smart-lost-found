"""Image upload handling: validation, storage and perceptual hashing."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.errors import ValidationError
from app.services.matching.image import compute_phash

_EXTENSION_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

_CHUNK = 64 * 1024


def upload_root() -> Path:
    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def store_image(upload: UploadFile, subdir: str = "reports") -> tuple[str, str]:
    """Validate and persist an uploaded image.

    Returns ``(relative_path, phash)`` where ``relative_path`` is what should be
    stored in ``ItemReport.photo_path`` (e.g. ``"reports/ab12.jpg"``).
    """
    content_type = (upload.content_type or "").lower()
    if content_type not in settings.allowed_image_type_list:
        raise ValidationError(
            "Unsupported image type.",
            fields={"photo": f"Allowed types: {', '.join(settings.allowed_image_type_list)}"},
        )

    payload = bytearray()
    while True:
        chunk = upload.file.read(_CHUNK)
        if not chunk:
            break
        payload.extend(chunk)
        if len(payload) > settings.max_upload_bytes:
            raise ValidationError(
                "Image is too large.",
                fields={"photo": f"Maximum size is {settings.max_upload_mb} MB"},
            )

    if not payload:
        raise ValidationError("The uploaded file is empty.", fields={"photo": "Empty file"})

    phash = compute_phash(bytes(payload))
    if phash is None:
        raise ValidationError(
            "The uploaded file is not a readable image.",
            fields={"photo": "Could not decode image"},
        )

    extension = _EXTENSION_BY_TYPE.get(content_type, Path(upload.filename or "").suffix or ".jpg")
    filename = f"{uuid.uuid4().hex}{extension}"

    directory = upload_root() / subdir
    directory.mkdir(parents=True, exist_ok=True)
    (directory / filename).write_bytes(bytes(payload))

    return f"{subdir}/{filename}", phash
