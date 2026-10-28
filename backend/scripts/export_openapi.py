"""
Write ``openapi.json`` to the backend root.

Frontends can generate typed API clients from it, e.g.::

    npx openapi-typescript openapi.json -o src/api-types.ts

Usage::

    python -m scripts.export_openapi
"""

from __future__ import annotations

import json
from pathlib import Path

from app.main import app


def main() -> None:
    target = Path(__file__).resolve().parent.parent / "openapi.json"
    schema = app.openapi()
    target.write_text(json.dumps(schema, indent=2), encoding="utf-8")

    paths = len(schema.get("paths", {}))
    operations = sum(len(item) for item in schema.get("paths", {}).values())
    print(f"Wrote {target}")
    print(f"  paths      : {paths}")
    print(f"  operations : {operations}")


if __name__ == "__main__":
    main()
