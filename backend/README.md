# Smart Lost & Found - Backend

A centralized **lost & found platform for a college campus**, with automatic
matching between `LOST` reports and `FOUND` reports, admin verification, and an
ownership-claim flow.

This repository contains **only the backend**. The UI will live in a sibling
`frontend/` folder next to `backend/` (see [Frontend handoff](#14-frontend-handoff)).

```
Student loses item  --> LOST report  --+
                                       +--> matching engine --> ranked leads
Finder hands item in --> FOUND report -+                            |
                                                                    v
                              admin verifies ownership --> item returned
```

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Architecture](#2-architecture)
3. [Quickstart](#3-quickstart)
4. [Demo accounts](#4-demo-accounts)
5. [Environment variables](#5-environment-variables)
6. [Authentication](#6-authentication)
7. [API reference](#7-api-reference)
8. [Data model](#8-data-model)
9. [The matching engine](#9-the-matching-engine)
10. [Status state machines](#10-status-state-machines)
11. [Privacy rules](#11-privacy-rules)
12. [File uploads](#12-file-uploads)
13. [API conventions](#13-api-conventions)
14. [Frontend handoff](#14-frontend-handoff)
15. [Testing](#15-testing)
16. [Limitations & roadmap](#16-limitations--roadmap)
17. [Troubleshooting / FAQ](#17-troubleshooting--faq)

---

## 1. What this is

| | |
|---|---|
| **Problem** | Lost items on a campus are tracked through WhatsApp groups, notice boards and word of mouth. Nothing connects a `LOST` report to a `FOUND` report. |
| **Solution** | One structured, searchable, trackable place for both. The server scores every possible `LOST`/`FOUND` pair and surfaces ranked leads to an admin. |
| **Scope** | REST API, database, matching engine, auth, uploads, demo data, tests. No UI. |
| **Stack** | Python 3.11+ - FastAPI - SQLAlchemy 2.0 - SQLite (default) or PostgreSQL - Pydantic v2 - rapidfuzz - Pillow/numpy |

**Design principles**

1. **The system suggests, a human decides.** No item is ever auto-returned; an
   admin must confirm the match and approve the claim.
2. **Explainable scoring.** Every match stores a per-signal breakdown, so the
   admin UI can show *why* a pair scored 91%.
3. **Privacy by construction.** Secret verification details live in a field that
   is never serialised to any client, and hidden category attributes are stripped
   per-viewer in a single serialisation layer.
4. **Zero external services.** No API keys, no cloud, no message broker. Clone,
   install, run.

---

## 2. Architecture

```
                        +------------------------------+
   HTTP (JSON)          |  FastAPI  (app/main.py)      |
  --------------------->|  CORS - error handlers       |
                        |  StaticFiles  /media/*       |
                        +--------------+---------------+
                                       |
                        +--------------v---------------+
                        |  Routers  app/api/v1/*.py    |
                        |  auth catalog reports claims |
                        |  matches admin notifications |
                        +--------------+---------------+
                                       |
              +------------------------+------------------------+
              |                        |                        |
              v                        v                        v
   +--------------------+   +--------------------+   +--------------------+
   | services/          |   | services/matching/ |   | models/            |
   | serializers        |   | blocking  scoring  |   | SQLAlchemy 2.0     |
   | uploads            |   | text      image    |   | 9 tables           |
   | notifications      |   | engine    config   |   |                    |
   | audit              |   +---------+----------+   +---------+----------+
   +--------------------+             |                        |
                                      +-----------+------------+
                                                  v
                                     +---------------------+
                                     | SQLite / PostgreSQL |
                                     +---------------------+
```

### Folder map

```
backend/
|-- app/
|   |-- main.py                 FastAPI app, CORS, static files, /health
|   |-- core/
|   |   |-- config.py           Settings (env vars) - single source of truth
|   |   |-- security.py         bcrypt hashing + JWT create/decode
|   |   |-- deps.py             get_current_user, require_admin, require_staff
|   |   |-- errors.py           AppError hierarchy + JSON error handlers
|   |   +-- pagination.py       PageParams dependency + paginate()
|   |-- db/
|   |   |-- base.py             Declarative Base, TimestampMixin, utcnow()
|   |   |-- session.py          engine, SessionLocal, get_db, create_all
|   |   +-- seed_base.py        idempotent catalog + locations + demo users
|   |-- models/                 SQLAlchemy tables (see section 8)
|   |   |-- enums.py            every enum value used by the system
|   |   |-- user.py location.py catalog.py report.py
|   |   +-- match.py claim.py notification.py audit.py
|   |-- schemas/                Pydantic request/response models
|   |   |-- common.py           UTCDateTime, Page[T], error models
|   |   +-- auth.py user.py catalog.py report.py match.py claim.py
|   |       notification.py admin.py
|   |-- services/
|   |   |-- matching/
|   |   |   |-- config.py       weights + thresholds (exposed at /meta)
|   |   |   |-- text.py         rapidfuzz similarity
|   |   |   |-- image.py        pHash (numpy DCT) + hamming distance
|   |   |   |-- scoring.py      pure scoring functions
|   |   |   |-- blocking.py     hard filters
|   |   |   +-- engine.py       DB orchestration, run_matching_for_report()
|   |   |-- serializers.py      ORM -> schema, applies privacy rules
|   |   |-- uploads.py          image validation + storage + hashing
|   |   |-- notifications.py    notify(), notify_admins()
|   |   +-- audit.py            record()
|   +-- api/v1/
|       |-- router.py           assembles every router
|       |-- auth.py catalog.py reports.py
|       |-- claims.py matches.py admin.py
|       +-- notifications.py meta.py
|-- scripts/
|   |-- seed_demo.py            demo dataset (24/17/9/6)
|   +-- export_openapi.py       writes openapi.json
|-- tests/                      pytest - 48 tests
|-- docs/
|   |-- API.md                  endpoint reference
|   +-- api.http                REST Client requests
|-- requirements.txt            runtime deps
|-- requirements-dev.txt        + pytest, httpx
|-- .env.example                documented environment template
|-- openapi.json                generated schema (for client codegen)
+-- README.md                   this file
```

---

## 3. Quickstart

> Verified on Windows 11 with Python 3.13. Linux/macOS commands are identical
> except for the venv activation path.

```bash
# 1. go to the backend
cd backend

# 2. create and activate a virtual environment
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (cmd):
.venv\Scripts\activate.bat
# macOS / Linux:
source .venv/bin/activate

# 3. install dependencies
pip install -r requirements-dev.txt

# 4. create your environment file
copy .env.example .env        # Windows
cp .env.example .env          # macOS / Linux

# 5. run the API (creates slf.db and seeds the base catalog on first boot)
uvicorn app.main:app --reload
```

Then open:

| URL | What |
|---|---|
| http://127.0.0.1:8000/docs | Swagger UI (click **Authorize** to paste a token) |
| http://127.0.0.1:8000/redoc | ReDoc |
| http://127.0.0.1:8000/openapi.json | Machine-readable schema |
| http://127.0.0.1:8000/health | Liveness + DB check |

### Load the demo dataset (recommended)

```bash
python -m scripts.seed_demo --reset
```

Expected output:

```
Demo data seeded
  lost reports     : 24
  found reports    : 17
  possible matches : 9
  items returned   : 6
```

Those are the exact numbers on the admin-dashboard slide of the project deck.
They are **computed by the matching engine**, not hard-coded - see section 9.8.

### Regenerate the OpenAPI file

```bash
python -m scripts.export_openapi
```

---

## 4. Demo accounts

Created automatically on first boot (`AUTO_SEED_BASE=true`).

| Role | Email | Password | Can do |
|---|---|---|---|
| `ADMIN` | `admin@campus.edu` | `Admin@123` | Everything, incl. user roles + audit log |
| `STAFF` | `staff@campus.edu` | `Staff@123` | Confirm/reject matches, approve/reject claims, view stats |
| `STUDENT` | `student@campus.edu` | `Student@123` | Create reports, view own matches, submit claims |

The demo seed also creates 12 students (`aarav@campus.edu` ... `tara@campus.edu`)
all with password `Student@123`.

> **Warning:** change these before any real deployment, and change `SECRET_KEY`
> in `.env`.

---

## 5. Environment variables

Copy `.env.example` to `.env`. Every key is optional; the defaults below work
out of the box.

| Key | Default | Notes |
|---|---|---|
| `APP_NAME` | `Smart Lost & Found API` | Shown in Swagger + `/` |
| `ENVIRONMENT` | `development` | `test` disables table creation/seeding |
| `VERSION` | `1.0.0` | Reported by `/health` and `/api/v1/meta` |
| `API_V1_PREFIX` | `/api/v1` | Change only if you also change the frontend base URL |
| `SECRET_KEY` | dev value | **Change in production.** `python -c "import secrets;print(secrets.token_urlsafe(64))"` |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | 24 h. Token is stateless - no refresh endpoint |
| `BCRYPT_ROUNDS` | `12` | Lower (e.g. `4`) only in tests |
| `DATABASE_URL` | `sqlite:///./slf.db` | Postgres: `postgresql+psycopg://user:pass@host:5432/db` |
| `UPLOAD_DIR` | `./uploads` | Created on boot |
| `MEDIA_URL_PREFIX` | `/media` | Public path for images |
| `MAX_UPLOAD_MB` | `5` | Per-image limit |
| `ALLOWED_IMAGE_TYPES` | `image/jpeg,image/png,image/webp` | Comma separated |
| `CORS_ORIGINS` | localhost:3000, :5173 (+127.0.0.1) | **Add your frontend origin here** |
| `AUTO_CREATE_TABLES` | `true` | Set `false` when you introduce migrations |
| `AUTO_SEED_BASE` | `true` | Inserts catalog/locations/demo users when empty |

### Switching to PostgreSQL

```bash
docker run -d --name slf-pg -e POSTGRES_USER=slf -e POSTGRES_PASSWORD=slf \
  -e POSTGRES_DB=slf -p 5432:5432 postgres:16
pip install "psycopg[binary]"
# .env
DATABASE_URL=postgresql+psycopg://slf:slf@localhost:5432/slf
```

Nothing else changes: all JSON columns are portable, and text similarity runs in
Python (rapidfuzz), not in the database.

---

## 6. Authentication

Stateless JWT bearer tokens.

**Flow**

```
POST /auth/register   --> user row (role is always STUDENT)
POST /auth/login/json --> { access_token, token_type, expires_in, user }
GET  /auth/me         --> current user   (header: Authorization: Bearer <token>)
```

There are **two login endpoints**, both returning the same body:

| Endpoint | Body | Use for |
|---|---|---|
| `POST /api/v1/auth/login` | `application/x-www-form-urlencoded` (`username`, `password`) | Swagger **Authorize** button |
| `POST /api/v1/auth/login/json` | JSON `{ "email", "password" }` | **Frontend** |

### curl example

```bash
# 1. log in
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login/json \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@campus.edu","password":"Admin@123"}'

# 2. use the token
curl -s http://127.0.0.1:8000/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Notes for the frontend**

- Store the token in memory or `sessionStorage`; there is no refresh token, so on
  `401` send the user back to the login page.
- All timestamps in the response are UTC ISO-8601 with a `Z` suffix.
- `403` means *authenticated but not allowed*; `401` means *not authenticated*.

---

## 7. API reference

Base URL: `http://127.0.0.1:8000/api/v1`
Full interactive reference: `/docs`. Machine-readable: `openapi.json`.
Also see [`docs/API.md`](docs/API.md) and [`docs/api.http`](docs/api.http).

Legend: public = no token - user = any logged-in user - staff = `STAFF` or
`ADMIN` - admin = `ADMIN` only.

### Auth

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Create a student account |
| POST | `/auth/login` | public | OAuth2 form login (Swagger) |
| POST | `/auth/login/json` | public | JSON login (frontend) |
| GET | `/auth/me` | user | Current profile |
| PATCH | `/auth/me` | user | Update own name / department / phone / roll number |
| POST | `/auth/change-password` | user | Change password |

### Catalog

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/categories` | public | All active categories (with `field_count`) |
| GET | `/categories/{key}` | public | Category + its attribute schema |
| GET | `/categories/{key}/fields` | public | Just the attribute schema (drives the dynamic form) |
| GET | `/locations` | public | Flat list; `?parent_id=` and `?q=` filters |
| GET | `/locations/tree` | public | Nested tree for a cascading picker |

### Reports

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/reports` | user | Create a LOST/FOUND report - **matching runs immediately** |
| GET | `/reports` | user | Search/filter/paginate reports |
| GET | `/reports/{id}` | user | Detail (privacy-filtered per viewer) |
| PATCH | `/reports/{id}` | owner / admin | Edit, then re-run matching |
| POST | `/reports/{id}/photo` | owner / admin | `multipart/form-data`, field name **`photo`** |
| POST | `/reports/{id}/close` | owner / admin | Soft-close (no hard delete exists) |
| GET | `/reports/{id}/matches` | owner / staff | Ranked matches for this report |

`GET /reports` query parameters:

| Param | Type | Example |
|---|---|---|
| `type` | `LOST` or `FOUND` | `?type=FOUND` |
| `category` | category key | `?category=calculator` |
| `location_id` | int | `?location_id=11` (includes descendants) |
| `status` | report status | `?status=OPEN` |
| `q` | string | `?q=calculator` (title + description) |
| `mine` | bool | `?mine=true` |
| `date_from` / `date_to` | ISO datetime | `?date_from=2026-09-01T00:00:00Z` |
| `page` / `page_size` | int | `?page=2&page_size=20` (max 100) |

### Claims

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/claims` | user | Claim a match; body `{ match_id, answers }` |
| GET | `/claims/mine` | user | My claims |

### Notifications

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/notifications` | user | Paginated; `?unread_only=true` |
| GET | `/notifications/unread-count` | user | Badge counter |
| POST | `/notifications/{id}/read` | user | Mark one read |
| POST | `/notifications/read-all` | user | Mark all read |

### Admin - matches

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/admin/matches` | staff | `?status=&band=&min_score=` |
| GET | `/admin/matches/{id}` | staff | **Includes `score_breakdown`** |
| POST | `/admin/matches/{id}/confirm` | staff | Mark CONFIRMED, reports -> MATCHED |
| POST | `/admin/matches/{id}/reject` | staff | Mark REJECTED |

### Admin - claims

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/admin/claims` | staff | `?status=PENDING` |
| POST | `/admin/claims/{id}/approve` | staff | -> both reports `RETURNED` |
| POST | `/admin/claims/{id}/reject` | staff | -> lost report back to `MATCHED` |

### Admin - dashboard

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/admin/stats/today` | staff | The four dashboard counters |
| GET | `/admin/verification-queue` | staff | Unreviewed matches, highest score first |
| GET | `/admin/users` | admin | `?q=` search |
| PATCH | `/admin/users/{id}/role` | admin | Promote/demote |
| GET | `/admin/audit-log` | admin | `?action=` filter |

### Meta

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/meta` | public | Version, upload limits, **live matching weights**, all enum values |
| GET | `/health` | public | Liveness + database check |
| GET | `/` | public | Service banner |

`/api/v1/meta` is the single call a frontend should make at boot - it returns
every enum value and the matching thresholds, so no constants need duplicating.

---

## 8. Data model

Nine tables. All timestamps are **naive UTC** in the database and are serialised
as ISO-8601 with a `Z` suffix.

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `email` | varchar(255) unique | Lower-cased on write |
| `hashed_password` | varchar(255) | bcrypt |
| `full_name` | varchar(120) | |
| `roll_number` | varchar(40) nullable | indexed |
| `role` | varchar(20) | `STUDENT` / `STAFF` / `ADMIN` |
| `department` | varchar(80) nullable | |
| `phone` | varchar(20) nullable | |
| `is_active` | bool | Deactivated users get `403` |
| `created_at`, `updated_at` | datetime | |

### `locations`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | varchar(120) | e.g. `Room 204` |
| `type` | varchar(20) | `BUILDING` / `BLOCK` / `FLOOR` / `ROOM` / `OTHER` |
| `parent_id` | FK -> locations.id | Self-referencing tree |
| `path` | varchar(400) | **Materialised** `"Main Block/Block B/Second Floor/Room 204"` |
| `depth` | int | Number of `/` separators |

`path` is what the matching engine compares. It is built once at seed time and
kept in sync by the seed script - if you add locations at runtime you must
compute the path yourself.

### `categories` / `category_fields`

`categories`: `id`, `key` (unique, e.g. `calculator`), `label`, `icon`,
`description`, `is_active`, `sort_order`.

`category_fields` (the dynamic form schema):

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `category_id` | FK | |
| `key` | varchar(40) | Stored as a key inside `item_reports.attributes` |
| `label` | varchar(80) | Shown in the form |
| `type` | varchar(20) | `TEXT` / `SELECT` / `NUMBER` / `BOOL` |
| `options` | JSON | For `SELECT` |
| `placeholder` | varchar(120) | |
| `is_required` | bool | Enforced only for non-hidden fields |
| `is_hidden` | bool | **Verification secret** - see section 11 |
| `sort_order` | int | |

Seeded categories: `id_card`, `calculator`, `bottle`, `earphones`, `books`,
`keys_usb`, `others`.

### `item_reports`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `reporter_id` | FK -> users.id | |
| `type` | varchar(10) | `LOST` / `FOUND` |
| `category_id` | FK -> categories.id | Blocking filter |
| `title` | varchar(140) | |
| `public_description` | text | Visible to everyone |
| `hidden_detail` | text | **NEVER serialised** - verification secret |
| `attributes` | JSON | Per-category structured values |
| `location_id` | FK -> locations.id nullable | |
| `occurred_at` | datetime | When it was lost / found |
| `status` | varchar(20) | See section 10 |
| `deposited_location_id` | FK -> locations.id nullable | FOUND only: where it was handed in |
| `photo_path` | varchar(255) | Relative path under `uploads/` |
| `photo_hash` | varchar(32) | 64-bit pHash, 16 hex chars |
| `closed_at` | datetime nullable | |
| `admin_note` | text nullable | Visible to owner + admins |
| `created_at`, `updated_at` | datetime | |

### `matches`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `lost_report_id` | FK -> item_reports.id | |
| `found_report_id` | FK -> item_reports.id | |
| `score` | int | 0-100 |
| `score_breakdown` | JSON | Full per-signal explanation (section 9.6) |
| `band` | varchar(10) | `HIGH` / `MEDIUM` |
| `status` | varchar(20) | `SUGGESTED` / `CONFIRMED` / `REJECTED` |
| `reviewed_by` | FK -> users.id nullable | |
| `reviewed_at` | datetime nullable | |
| `review_note` | varchar(255) nullable | |
| `created_at`, `updated_at` | datetime | |

`UNIQUE(lost_report_id, found_report_id)` - one row per pair, updated in place.

### `claims`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `match_id` | FK -> matches.id | |
| `claimant_id` | FK -> users.id | Must own the LOST report |
| `answers` | JSON | `{"hidden_detail": "...", "questions": [...]}` |
| `status` | varchar(20) | `PENDING` / `APPROVED` / `REJECTED` |
| `decided_by` | FK -> users.id nullable | |
| `decided_at` | datetime nullable | |
| `notes` | text nullable | |
| `created_at`, `updated_at` | datetime | |

### `notifications` / `audit_log`

`notifications`: `id`, `user_id`, `type`, `title`, `body`, `payload` (JSON),
`is_read`, `created_at`, `updated_at`.

`audit_log`: `id`, `actor_id`, `action` (e.g. `match.confirm`, `claim.approve`,
`user.role_change`), `entity`, `entity_id`, `meta` (JSON), timestamps.

---

## 9. The matching engine

The engine is a **scoring funnel**, not a black box:

```
all found reports
      |
      v  BLOCKING  (category match, date order, <= 14 days)
 candidate pairs  (typically 0-20)
      |
      v  SCORING   5 independent signals, each 0.0-1.0
 weighted score 0-100
      |
      v  THRESHOLDS
  >= 85  HIGH   -> notify both users + admin queue
  >= 65  MEDIUM -> admin queue only
  <  65  discard (not stored)
      |
      v
  admin confirms -> claim -> approve -> returned
```

Everything below lives in `app/services/matching/`. Constants are in
`config.py` and are also served by `GET /api/v1/meta`.

### 9.1 Blocking (hard filters)

`blocking.is_candidate_pair()` rejects a pair when:

| Rule | Reject reason |
|---|---|
| Not one `LOST` + one `FOUND` | `wrong_report_types` |
| Different category | `category_mismatch` |
| Same report | `same_report` |
| Found timestamp > 12 h **before** lost timestamp | `found_before_lost` |
| Gap > 14 days | `outside_time_window` |

The 12-hour grace absorbs sloppy reporting ("I found it at 9 am" when it was
actually lost at 11 am). The SQL query already restricts to the same category
and a +/-14-day window, so Python only sees a handful of rows.

### 9.2 Location score

Paths are compared segment by segment:

| Situation | Score |
|---|---|
| Identical path | `1.00` |
| Same parent (adjacent rooms on one floor) | `0.80` |
| Same block, different floor | `0.60` |
| Same building, different block | `0.40` |
| Nothing in common | `0.15` |
| Either report has no location | `None` -> signal dropped |

### 9.3 Time score

Piecewise decay (chosen over an exponential so it can be explained in one line):

| Gap between lost and found | Score |
|---|---|
| <= 2 h | `1.00` |
| <= 24 h | `0.85` |
| <= 3 days | `0.60` |
| <= 7 days | `0.35` |
| <= 14 days | `0.15` |
| > 14 days, or found > 12 h before lost | `0.00` |

### 9.4 Text score

`0.5 x token_set_ratio + 0.5 x ratio`, both from **rapidfuzz**, after lowercasing,
stripping punctuation, collapsing whitespace and removing stopwords.

- `token_set_ratio` handles word order ("black scientific calculator" vs
  "scientific black calculator").
- `ratio` (Indel distance) handles typos ("calclator" -> ~0.94 vs "calculator").

### 9.5 Attribute & image scores

**Attributes** - average agreement over the fields *both* reports filled in:

| Case | Value |
|---|---|
| Equal (case-insensitive) | `1.0` |
| Similar (>= 0.80 char ratio) | `0.6` |
| Somewhat similar (>= 0.50) | `0.35` |
| Conflicting | `0.1` |
| Missing on either side | **skipped** (not penalised) |

**Image** - 64-bit perceptual hash (DCT-based, implemented in `image.py` with
numpy; no scipy/imagehash dependency). Similarity = `1 - hamming_distance / 64`.
`None` when either report has no photo.

### 9.6 Combined score

```python
weights = {
    "location": 0.30, "time": 0.25, "text": 0.20,
    "attributes": 0.15, "image": 0.10,
}
```

**Unavailable signals are dropped and the weights renormalised** - a report is
never punished for not having a photo.

```
base  = sum(weight_i * signal_i) / sum(weight_i)   # over available signals only
final = min(1.0, base + hidden_detail_bonus)       # bonus = 0.15 when the secret
score = round(final * 100)                         # details match (>= 0.60 similarity)
```

Per-category overrides (each sums to 1.0):

| Category | location | time | text | attributes | image |
|---|---|---|---|---|---|
| `calculator` | 0.30 | 0.20 | 0.20 | 0.20 | 0.10 |
| `books` | 0.30 | 0.20 | 0.25 | 0.15 | 0.10 |
| `id_card` | 0.25 | 0.15 | 0.15 | **0.35** | 0.10 |
| `bottle` | 0.25 | 0.20 | 0.15 | **0.30** | 0.10 |
| `keys_usb` | 0.25 | 0.25 | 0.15 | 0.25 | 0.10 |
| _default_ | 0.30 | 0.25 | 0.20 | 0.15 | 0.10 |

**Every match stores its breakdown.** `GET /api/v1/admin/matches/{id}` returns:

```json
"score_breakdown": {
  "signals": { "location": 1.0, "time": 1.0, "text": 0.93, "attributes": 1.0, "image": null },
  "effective_weights": { "location": 0.33, "time": 0.22, "text": 0.22, "attributes": 0.22 },
  "weights_used": { "location": 0.30, "time": 0.20, "text": 0.20, "attributes": 0.20 },
  "signals_used": ["attributes", "location", "text", "time"],
  "signals_missing": ["image"],
  "base_score": 96.3,
  "hidden_detail_similarity": 0.0,
  "hidden_detail_bonus": 0.0,
  "final_score": 96,
  "band": "HIGH"
}
```

This is exactly what the admin "why did this match?" panel should render.

### 9.7 When matching runs

| Trigger | Where |
|---|---|
| Report created | `reports.create_report` |
| Report edited | `reports.update_report` |
| Photo uploaded | `reports.upload_photo` |
| Manual bulk recompute | `engine.recompute_all(db)` (no endpoint; call from a script) |

Matching compares the new report against candidates of the opposite type only -
never the whole table. `HIGH` band matches additionally create notifications for
both reporters, and both reports move to `MATCHED`.

### 9.8 Seed dataset and the deck's numbers

`scripts/seed_demo.py` creates:

- **9 story pairs** (lost + found with near-identical details) -> **9 matches**
- **15 lost reports filed "today"** with no counterpart -> they cannot match,
  because any existing found report predates them (`found_before_lost` filter)
- **8 found reports from 25-40 days ago** -> they also predate everything

Result: 24 lost, 17 found, 9 matches, 6 returned - the deck's dashboard numbers,
produced by the real formula.

Computed scores for the seeded pairs (they cluster high because the pairs are
deliberately near-identical):

| Item | Score | Band | Status |
|---|---|---|---|
| USB drive with two keys | 97 | HIGH | SUGGESTED |
| Black scientific calculator | 97 | HIGH | SUGGESTED |
| Grey calculator | 96 | HIGH | CONFIRMED |
| Black wired earphones | 95 | HIGH | CONFIRMED |
| White wireless earbuds | 94 | HIGH | CONFIRMED |
| Data Structures textbook | 93 | HIGH | CONFIRMED |
| Blue steel water bottle | 91 | HIGH | SUGGESTED |
| College ID card | 90 | HIGH | CONFIRMED |
| Black gym bottle | 87 | HIGH | CONFIRMED |

> The deck showed `87% / 81% / 76%`. Those were illustrative. The engine is
> deterministic, so the numbers above are what the formula actually produces for
> this data. Edit `scripts/seed_demo.py` if you want a wider spread.

---

## 10. Status state machines

```
LOST report
  OPEN --> MATCHED --> CLAIMED --> RETURNED
    |         |           |
    +---------+-----------+--------> CLOSED
                                     EXPIRED (reserved, not yet automated)

FOUND report
  OPEN --> MATCHED --> HANDED_OVER --> RETURNED
    |         |
    +---------+---------------------> CLOSED

Match
  SUGGESTED --> CONFIRMED
      |
      +-------> REJECTED

Claim
  PENDING --> APPROVED
     |
     +-----> REJECTED
```

Legal transitions are enforced in the routers (`ConflictError` / `409` on
illegal moves). Practical rules:

- Editing is allowed while the report is `OPEN` or `MATCHED` (owner), or any
  time (admin).
- A `RETURNED` / `CLOSED` / `EXPIRED` report is never re-matched.
- A confirmed match cannot be rejected.
- Approving a claim sets **both** reports to `RETURNED`.

---

## 11. Privacy rules

Enforced in `app/services/serializers.py` - one place, so no router can leak.

| Field | Who can see it |
|---|---|
| `public_description`, `title`, `location`, `occurred_at`, `status` | Everyone authenticated |
| `hidden_detail` (free text secret) | **Nobody.** Not in any response schema. Only exposed as the boolean `has_hidden_detail`. |
| `attributes` (public keys) | Everyone authenticated |
| `attributes` (keys where `category_field.is_hidden = true`) | Owner + admins, via `hidden_attributes`. Empty dict for everyone else. |
| `reporter_name` | Owner + admins. `null` for other students. |
| `admin_note` | Owner + admins |
| `score_breakdown` | Admins only (`MatchDetail`). Students get `MatchOut` without it. |

**Why `hidden_detail` is never returned:** it is the answer key. The claimant must
*type* it in the claim form; if the client ever received it, verification would be
meaningless.

Tested by `tests/test_api.py::test_hidden_detail_never_leaks`.

---

## 12. File uploads

```
POST /api/v1/reports/{id}/photo
Content-Type: multipart/form-data
field name: photo
```

| Rule | Value |
|---|---|
| Allowed types | `image/jpeg`, `image/png`, `image/webp` |
| Max size | `MAX_UPLOAD_MB` (default 5 MB) |
| Stored at | `UPLOAD_DIR/reports/<uuid>.<ext>` |
| Returned as | `photo_url: "/media/reports/<uuid>.jpg"` |
| Side effect | `photo_hash` (pHash) is computed and matching is re-run |

Validation is layered: MIME type -> size (streamed, so a huge file is rejected
before it is fully read) -> Pillow decode (rejects non-images) -> pHash.

Uploading again replaces the previous file reference (the old file is not
deleted - acceptable for a project, see roadmap).

---

## 13. API conventions

### Pagination envelope

Every list endpoint returns:

```json
{
  "items": [ ... ],
  "total": 41,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

Query params: `page` (1-based, default 1), `page_size` (1-100, default 20).

### Error envelope

```json
{
  "detail": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "fields": { "attributes.nonsense": "Unknown attribute for category 'calculator'" }
  }
}
```

| Status | `code` |
|---|---|
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `VALIDATION_ERROR` |

### Dates

All input timestamps may be sent with or without an offset. Naive values are
assumed to be **UTC**. All output timestamps are `YYYY-MM-DDTHH:MM:SSZ`.

### Booleans in query strings

FastAPI accepts `true/false/1/0` (e.g. `?mine=true`).

---

## 14. Frontend handoff

This section is written for the next developer (or AI) building the UI.

### Connection

```ts
const API_BASE = "http://127.0.0.1:8000/api/v1";
const MEDIA_BASE = "http://127.0.0.1:8000";   // photo_url is already an absolute path
```

Add your dev origin to `CORS_ORIGINS` in `.env` if it is not
`localhost:3000` / `localhost:5173`.

### Boot sequence

1. `GET /api/v1/meta` -> cache enums, thresholds, upload limits.
2. `GET /api/v1/categories` -> build the category picker.
3. `GET /api/v1/locations/tree` -> build the location picker.
4. If a token exists -> `GET /api/v1/auth/me`; on `401`, clear it.

### Suggested page -> endpoint map

| Page | Endpoints |
|---|---|
| Login / Register | `POST /auth/login/json`, `POST /auth/register` |
| Home / feed | `GET /reports`, `GET /notifications/unread-count` |
| Report item (lost or found) | `GET /categories`, `GET /categories/{key}/fields`, `GET /locations/tree`, `POST /reports`, then `POST /reports/{id}/photo` |
| My reports | `GET /reports?mine=true` |
| Report detail | `GET /reports/{id}`, `GET /reports/{id}/matches`, `POST /reports/{id}/close` |
| Claim an item | `POST /claims` |
| My claims | `GET /claims/mine` |
| Notifications | `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all` |
| Admin dashboard | `GET /admin/stats/today`, `GET /admin/verification-queue` |
| Admin match review | `GET /admin/matches/{id}` (show `score_breakdown`), `POST /admin/matches/{id}/confirm`, `POST /admin/matches/{id}/reject` |
| Admin claim review | `GET /admin/claims?status=PENDING`, `POST /admin/claims/{id}/approve`, `POST /admin/claims/{id}/reject` |
| Admin users | `GET /admin/users`, `PATCH /admin/users/{id}/role` |

### Dynamic report form

Do **not** hard-code fields. Build the form from
`GET /categories/{key}/fields`:

| `type` | Render as |
|---|---|
| `TEXT` | text input |
| `SELECT` | dropdown using `options` |
| `NUMBER` | numeric input |
| `BOOL` | checkbox / toggle |

Rules:

- Skip fields where `is_hidden = true` on **FOUND** reports (a finder cannot know
  the owner's secret details). Show them on **LOST** reports only, labelled as
  "for verification".
- `is_required` applies to non-hidden fields.
- Send the values as a flat object in `attributes`, keyed by `field.key`.
- `hidden_detail` is a separate top-level string field (not part of `attributes`).

### Rendering a match

- Students see `score` and `band` only. Show it as *"87% possible match"*.
- Never render a `found_report` as a confirmed answer - show location + generic
  description, and prompt the user to answer the verification questions.
- Admins can render `score_breakdown.signals` as a small bar chart:
  Location / Time / Text / Attributes / Image.

### Type generation

```bash
npx openapi-typescript ./openapi.json -o src/api-types.ts
```

### Suggested UI states

`OPEN` -> neutral - `MATCHED` -> blue badge - `CLAIMED` -> amber -
`RETURNED` -> green - `CLOSED`/`EXPIRED` -> grey.

---

## 15. Testing

```bash
pip install -r requirements-dev.txt
pytest
```

```
48 passed
```

| File | Covers |
|---|---|
| `tests/test_matching.py` | Location bands, time decay, typo-tolerant text similarity, attribute conflicts, pHash stability/resize tolerance, full calculator pair scoring, breakdown shape |
| `tests/test_api.py` | Register/login/401/403, duplicate email, role escalation blocked, catalog, report creation, **matching triggered on create**, hidden-detail leak test, filters, full claim flow (create -> approve -> RETURNED), notifications, `/meta` |

The suite uses an in-memory SQLite database per test and `BCRYPT_ROUNDS=4` for
speed. No test touches `slf.db` or `uploads/`.

Useful single-test commands:

```bash
pytest tests/test_matching.py -v
pytest -k "claim" -v
```

---

## 16. Limitations & roadmap

Deliberate simplifications, in rough priority order:

1. **No migrations.** Tables are created with `Base.metadata.create_all`. Adding
   a column means deleting `slf.db`. Add Alembic before any real deployment.
2. **Weights are hand-tuned.** The plan is to log
   `(score_breakdown, admin_decision)` and fit a logistic regression once ~200
   reviewed matches exist, so the weights calibrate themselves.
3. **Image matching is perceptual, not semantic.** pHash catches re-uploads and
   identical items; it cannot match the front and back of one bottle. Upgrade
   path: CLIP embeddings + `pgvector`.
4. **No email/SMS.** Notifications are in-app rows only. Add an outbox + worker
   for email/push.
5. **No refresh tokens.** A 24-hour access token with re-login on expiry.
6. **`EXPIRED` is never set automatically.** Add a scheduled job that closes
   `OPEN` reports older than N days.
7. **Old photos are not deleted** when replaced.
8. **Category families are not matched across.** `keys_usb` is one category;
   a `Keys` vs `USB` pair still needs the same category key.
9. **No rate limiting** on login or report creation.
10. **SQLite in production** is not recommended under concurrent writes.

---

## 17. Troubleshooting / FAQ

**`sqlite3.OperationalError: no such table`**
Run `uvicorn` once (it creates tables), or call `python -m scripts.seed_demo`.

**I changed a model and the DB is stale**
Delete `slf.db` and restart. There are no migrations yet (see 16.1).

**`401 Unauthorized` on every request**
The header must be exactly `Authorization: Bearer <token>` - no `Token` prefix.

**`403` when logged in as a student**
Admin endpoints need `STAFF` or `ADMIN`. Promote with
`PATCH /api/v1/admin/users/{id}/role` using the admin account.

**CORS error in the browser**
Add your origin to `CORS_ORIGINS` in `.env` and restart the server.

**Photos return 404**
Check that `uploads/` exists and that `photo_path` is relative
(`reports/abc.jpg`, not `/uploads/reports/abc.jpg`). The static mount serves
`MEDIA_URL_PREFIX` from `UPLOAD_DIR`.

**Matching returns nothing**
Checklist: same `category_id`? found timestamp >= lost timestamp - 12 h? gap
<= 14 days? score >= 65? Inspect with
`GET /api/v1/reports/{id}/matches?min_score=0` (as the owner or admin).

**Scores look too high**
The seeded demo pairs are near-identical by design. Real reports with vaguer
descriptions land lower. Inspect `score_breakdown` to see which signal is
carrying the score.

**`bcrypt` warning about 72 bytes**
Passwords are truncated to 72 bytes (a bcrypt limit); the API caps password
length at 72 characters.

**Swagger "Authorize" does not work**
Use the form login (`POST /auth/login`) - it returns the token body Swagger
expects. The `/auth/login/json` variant is for the frontend.

---

## Project credits

Backend implementation of the **Smart Lost & Found System for Educational
Institutions** design-thinking project.

Matching weights, thresholds and formulas are all in
`app/services/matching/config.py` - change them there, nowhere else.
