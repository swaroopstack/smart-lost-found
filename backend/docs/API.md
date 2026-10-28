# API reference (quick sheet)

Base URL: `http://127.0.0.1:8000/api/v1`
Interactive: `/docs` · Schema: `openapi.json` · Full narrative: `../README.md`

Access: 🔓 public · 👤 authenticated · 🛡️ STAFF/ADMIN · 🔑 ADMIN

---

## Auth

| Method | Path | Access | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | `{email, password, full_name, roll_number?, department?, phone?}` → 201 `UserOut`. Role is always `STUDENT`. |
| POST | `/auth/login` | 🔓 | form-urlencoded `username`(=email), `password` → `Token` |
| POST | `/auth/login/json` | 🔓 | `{email, password}` → `Token` |
| GET | `/auth/me` | 👤 | → `UserOut` |
| PATCH | `/auth/me` | 👤 | `{full_name?, department?, phone?, roll_number?}` |
| POST | `/auth/change-password` | 👤 | `{current_password, new_password}` |

`Token` = `{ access_token, token_type: "bearer", expires_in, user }`

---

## Catalog

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/categories` | 🔓 | `CategoryOut[]` incl. `field_count` |
| GET | `/categories/{key}` | 🔓 | `CategoryDetail` incl. `fields[]` |
| GET | `/categories/{key}/fields` | 🔓 | `CategoryFieldOut[]` |
| GET | `/locations` | 🔓 | `?parent_id=&q=` → `LocationOut[]` |
| GET | `/locations/tree` | 🔓 | `LocationNode[]` (nested `children`) |

---

## Reports

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/reports` | 👤 | `ReportCreate` → 201 `ReportDetail`; matching runs synchronously |
| GET | `/reports` | 👤 | see filters below |
| GET | `/reports/{id}` | 👤 | `ReportDetail` (privacy-filtered) |
| PATCH | `/reports/{id}` | 👤/🔑 | `ReportUpdate`; re-runs matching |
| POST | `/reports/{id}/photo` | 👤/🔑 | multipart, field `photo` |
| POST | `/reports/{id}/close` | 👤/🔑 | `{reason?}` |
| GET | `/reports/{id}/matches` | 👤/🛡️ | `?min_score=` → `MatchOut[]` (no breakdown) |

`ReportCreate`

```json
{
  "type": "LOST",
  "category_key": "calculator",
  "title": "Black scientific calculator",
  "public_description": "Casio fx-991EX, scratch near the display",
  "hidden_detail": "red dragon sticker inside the cover",
  "attributes": { "brand": "Casio", "colour": "Black", "model": "fx-991EX", "has_case": true },
  "location_id": 11,
  "occurred_at": "2026-10-27T09:20:00Z",
  "deposited_location_id": null
}
```

`GET /reports` filters: `type`, `category`, `location_id`, `status`, `q`, `mine`,
`date_from`, `date_to`, `page`, `page_size`.

---

## Claims

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/claims` | 👤 | `{match_id, answers}` → 201 `ClaimDetail`. Caller must own the LOST report. |
| GET | `/claims/mine` | 👤 | paginated `ClaimOut` |

---

## Notifications

| Method | Path | Access |
|---|---|---|
| GET | `/notifications` | 👤 (`?unread_only=`) |
| GET | `/notifications/unread-count` | 👤 |
| POST | `/notifications/{id}/read` | 👤 |
| POST | `/notifications/read-all` | 👤 |

---

## Admin

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/admin/matches` | 🛡️ | `?status=&band=&min_score=&page=` |
| GET | `/admin/matches/{id}` | 🛡️ | `MatchDetail` **with `score_breakdown`** |
| POST | `/admin/matches/{id}/confirm` | 🛡️ | `{note?}` |
| POST | `/admin/matches/{id}/reject` | 🛡️ | `{note?}` |
| GET | `/admin/claims` | 🛡️ | `?status=` |
| POST | `/admin/claims/{id}/approve` | 🛡️ | `{notes?}` → reports `RETURNED` |
| POST | `/admin/claims/{id}/reject` | 🛡️ | `{notes?}` |
| GET | `/admin/stats/today` | 🛡️ | dashboard counters |
| GET | `/admin/verification-queue` | 🛡️ | `?limit=` |
| GET | `/admin/users` | 🔑 | `?q=` |
| PATCH | `/admin/users/{id}/role` | 🔑 | `{role}` |
| GET | `/admin/audit-log` | 🔑 | `?action=` |

`GET /admin/stats/today` →

```json
{
  "date": "2026-10-27",
  "lost_reports": 24,
  "found_reports": 17,
  "possible_matches": 9,
  "items_returned": 6,
  "pending_claims": 0,
  "open_reports": 15
}
```

Definitions: `lost_reports`/`found_reports` = created today ·
`possible_matches` = matches created today, not rejected ·
`items_returned` = claims approved today · `pending_claims` and `open_reports`
are all-time.

---

## Meta

| Method | Path | Access |
|---|---|---|
| GET | `/meta` | 🔓 |
| GET | `/health` | 🔓 (no `/api/v1` prefix) |
| GET | `/` | 🔓 (no prefix) |

---

## Shared types

```ts
type Page<T> = { items: T[]; total: number; page: number; page_size: number; pages: number }

type ReportPublic = {
  id: number; type: "LOST" | "FOUND"; category: CategoryOut; title: string;
  public_description: string | null; location: LocationOut | null;
  occurred_at: string; status: ReportStatus; photo_url: string | null;
  reporter_id: number; reporter_name: string | null; is_mine: boolean;
  has_hidden_detail: boolean; created_at: string;
}

type ReportDetail = ReportPublic & {
  attributes: Record<string, unknown>;        // public keys only
  hidden_attributes: Record<string, unknown>; // owner/admin only, else {}
  deposited_location: LocationOut | null;
  admin_note: string | null;
  matches_count: number;
  updated_at: string;
}

type MatchOut = {
  id: number; score: number; band: "HIGH" | "MEDIUM";
  status: "SUGGESTED" | "CONFIRMED" | "REJECTED";
  lost_report: ReportPublic; found_report: ReportPublic;
  created_at: string; reviewed_at: string | null;
}

type MatchDetail = MatchOut & {
  score_breakdown: {
    signals: Record<"location"|"time"|"text"|"attributes"|"image", number | null>;
    effective_weights: Record<string, number>;
    weights_used: Record<string, number>;
    signals_used: string[];
    signals_missing: string[];
    base_score: number;
    hidden_detail_similarity: number;
    hidden_detail_bonus: number;
    final_score: number;
    band: "HIGH" | "MEDIUM" | null;
  };
  review_note: string | null;
  reviewed_by: number | null;
}
```

## Error shape

```json
{ "detail": { "code": "NOT_FOUND", "message": "...", "fields": { "field": "reason" } } }
```

Codes: `UNAUTHORIZED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) ·
`CONFLICT` (409) · `VALIDATION_ERROR` (422).
