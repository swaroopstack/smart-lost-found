# CampusFind frontend

React + TypeScript single-page app for the Smart Lost & Found System. It talks to the
FastAPI backend in `../backend` and never talks to the database directly.

## Stack

- React 18 + TypeScript + Vite 5
- Tailwind CSS 3 with semantic design tokens (no component library)
- React Router 6
- TanStack Query 5 for server state
- react-hook-form + zod for forms
- Phosphor icons
- date-fns for dates

## Run it

### One-click (Windows)

Double-click **`START-APP.bat`** in the project root (one level above `frontend`).
It starts the backend and frontend in two windows, waits until both answer,
and opens http://localhost:5173/login in your browser. Re-running it reuses
whatever is already running. Close the two server windows to stop everything.

### Manually

Start the backend first (from `../backend`):

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

Then start the frontend:

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The API origin defaults to
`http://127.0.0.1:8000/api/v1`; copy `.env.example` to `.env` if you need to change it.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@campus.edu` | `Student@123` |
| Staff | `staff@campus.edu` | `Staff@123` |
| Admin | `admin@campus.edu` | `Admin@123` |

## Scripts

```powershell
npm run dev      # Vite dev server with HMR
npm run build    # tsc && vite build
npm run preview  # serve dist on :5173 (stop dev first; the backend CORS list includes :5173)
```

## Routes

| Path | Who | What |
| --- | --- | --- |
| `/login`, `/register` | public | Sign in / create an account |
| `/` | signed in | Personal overview, recent reports, staff queue preview |
| `/browse` | signed in | Search and filter lost/found reports |
| `/reports/new` | signed in | Three-step report wizard with draft autosave |
| `/reports/:id` | signed in | Report detail, matches, claim flow |
| `/my-reports`, `/my-claims` | signed in | Personal activity |
| `/notifications`, `/profile` | signed in | Inbox and account settings |
| `/admin` | staff, admin | Desk dashboard, today's counters, verification queue |
| `/admin/matches`, `/admin/matches/:id` | staff, admin | Match queue and score breakdown |
| `/admin/claims` | staff, admin | Approve or reject ownership claims |
| `/admin/users`, `/admin/audit` | admin | Role management and audit trail |
| `/forbidden`, `*` | signed in | Permission and not-found states |

## Privacy rules encoded in the UI

- `hidden_detail` is never requested for display and never rendered. Only a boolean
  "a private detail is on file" hint is shown.
- Hidden category attributes (for example an ID card's holder name and roll number)
  are rendered only when the API returns them, which it does for the owner and admins.
- Score breakdowns are staff-only; students see the score and band only.
- Nothing in the UI implies an item is returned automatically. Every claim is described
  as a request that a member of staff reviews.

## Project layout

```
src/
  api/          fetch client, typed endpoints, OpenAPI-generated schema
  auth/         AuthProvider, RequireAuth, RequireRole
  components/
    ui/         buttons, inputs, modal, toast, states, pagination
    domain/     report cards, match cards, score meter, claim dialog
    layout/     app shell, sidebar, topbar, navigation
  lib/          formatting, constants, report form schema, storage
  pages/        route components (admin pages under pages/admin)
```

`src/api/schema.ts` is generated from the backend contract:

```powershell
npx openapi-typescript ..\backend\openapi.json -o src\api\schema.ts
```

## Design notes

The interface follows the "UI/UX Pro Max" guidance bundled for this project: a calm
Swiss layout, one accent colour, visible focus rings, 44px minimum touch targets,
skip links, reduced-motion support, and explicit loading, empty, error and forbidden
states on every data view. Typography is Fira Sans for prose and Fira Code for numbers
and identifiers. There are no gradients and no chart library; scores are drawn with
accessible HTML meters and labelled tables.

The match queue switches to readable cards below 1280px, and the admin tables keep
their primary columns on phones instead of forcing horizontal scrolling.

## Quality checks

- `tsc --noEmit` passes with `strict`, `noUnusedLocals` and `noUnusedParameters`.
- `npm run build` completes with split vendor chunks (react / query / forms).
- A Playwright smoke pass covers login, browse, report detail, staff and admin views,
  mobile navigation and a hidden-detail leak check on every public list.
- Axe audits pass WCAG 2.0/2.1 A and AA on every page, the claim and confirm dialogs,
  and the mobile navigation drawer.
