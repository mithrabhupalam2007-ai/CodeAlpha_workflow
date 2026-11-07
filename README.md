# WorkFlow

**WorkFlow** is a full-stack project management web application inspired by **Trello** and **Asana** — boards, projects, tasks, and team collaboration with a premium SaaS UI.

> **Status: Phase 5 complete** — the complete task-management module is in: full task fields (title, description, project, assignee, priority, status, start/due dates, labels, subtasks, link attachments), create/edit/delete, search + filters + sort (deadline & priority), and membership/permission checks on every backend operation. Next: realtime collaboration via Socket.IO.

## Tech Stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Frontend  | React 19 + Vite 8, React Router 7, Axios                |
| Styling   | Tailwind CSS v4 (design tokens in CSS), Lucide React    |
| Backend   | Node.js + Express 5                                     |
| Database  | MongoDB + Mongoose 9                                    |
| Realtime  | Socket.IO 4                                             |

## Project Structure

```
CodeAlpha_workflow/
├── backend/                     # Express API
│   ├── .env                     # local env config (git-ignored)
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── server.js            # entrypoint: env → DB → HTTP + Socket.IO → listen
│       ├── app.js               # express app: cors, cookies, CSRF guard, routes, 404, errors
│       ├── config/db.js         # mongoose connection (graceful if DB is down)
│       ├── controllers/
│       │   ├── auth.controller.js   # signup, login, logout, me, refresh, forgot/reset
│       │   ├── dashboard.controller.js  # summary + activity feed
│       │   ├── project.controller.js    # CRUD, archive/restore, members & roles
│       │   ├── invitation.controller.js # invite / accept / decline / revoke
│       │   ├── task.controller.js       # list/search/filter/sort, CRUD, subtasks, attachments
│       │   └── health.controller.js
│       ├── middleware/
│       │   ├── requireAuth.js   # JWT verification (protected routes)
│       │   ├── csrf.js          # double-submit CSRF token issue + guard
│       │   ├── validate.js      # express-validator → per-field 400s
│       │   ├── notFound.js
│       │   └── errorHandler.js
│       ├── models/
│       │   ├── User.js          # bcrypt pre-save hook, password: select:false
│       │   ├── Project.js       # color, status, owner, members[] with roles
│       │   ├── Invitation.js    # email invites: token, role, expiry, status
│       │   ├── Task.js          # title, status, priority, dates, labels, subtasks, attachments
│       │   └── Activity.js      # per-user activity feed entries
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── dashboard.routes.js
│       │   ├── project.routes.js
│       │   ├── invitation.routes.js
│       │   ├── task.routes.js
│       │   └── health.routes.js
│       ├── scripts/
│       │   └── seed.js          # realistic demo data (npm run seed -- --reset)
│       ├── services/
│       │   └── stats.js         # shared aggregations (counters, progress, weekly trend)
│       ├── sockets/
│       │   └── socket.js        # Socket.IO init + rooms scaffolding
│       └── utils/
│           ├── permissions.js   # role model: owner > admin > editor > viewer
│           ├── token.js         # JWT sign/verify + HTTP-only cookie helpers
│           └── sendEmail.js     # SMTP (nodemailer) or console fallback
│
├── frontend/                    # React app (Vite)
│   ├── .env                     # local env config (git-ignored)
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── public/favicon.svg
│   ├── vite.config.js           # react + tailwind plugins, /api & socket proxy
│   └── src/
│       ├── main.jsx             # root: BrowserRouter + AuthProvider + SocketProvider
│       ├── App.jsx
│       ├── api/
│       │   ├── client.js        # axios: credentials, CSRF header, silent refresh
│       │   ├── auth.js          # auth endpoint calls
│       │   ├── dashboard.js     # summary + activity feed
│       │   ├── projects.js      # project CRUD, archive/restore, members
│       │   ├── invitations.js   # invite / accept / decline / revoke
│       │   ├── tasks.js         # task CRUD, status, subtasks, attachments
│       │   └── health.js
│       ├── components/
│       │   ├── dashboard/       # dashboard panels (progress, donut, tasks, activity…)
│       │   ├── layout/          # Layout, Sidebar (navy), Topbar, NotificationsMenu, UserMenu
│       │   ├── projects/        # ProjectFormModal, ActionsMenu, Members, Invitations
│       │   ├── tasks/           # TaskRow, TaskFilters, TaskFormModal, TaskDetailModal
│       │   ├── routes/ProtectedRoute.jsx  # protected + guest route guards
│       │   └── ui/              # Logo, StatCard, Card, Modal, ConfirmDialog, charts…
│       ├── context/
│       │   ├── AuthContext.jsx  # session state (cookie-based, no token in JS)
│       │   └── SocketContext.jsx
│       ├── hooks/
│       │   ├── useDashboard.js  # loads /api/dashboard/summary (loading/error/refetch)
│       │   ├── useTasks.js      # loads /api/tasks with filter/sort params
│       │   ├── useClickOutside.js
│       │   └── useHealth.js     # polls /api/health
│       ├── pages/               # Dashboard, Projects, ProjectDetail, Tasks, NotFound
│       │   └── auth/            # Login, Signup, ForgotPassword, ResetPassword, AuthLayout
│       ├── routes/AppRoutes.jsx
│       ├── styles/index.css     # Tailwind v4 @theme design tokens
│       ├── utils/
│       │   ├── cn.js
│       │   ├── dates.js         # relative time, due labels, initials
│       │   ├── permissions.js   # frontend mirror of the backend role model
│       │   ├── projectColors.js # color/status/priority tokens
│       │   └── validation.js    # client-side rules mirroring the backend
│       └── …
│
├── scripts/
│   ├── auth-smoke.mjs           # 33-check auth regression test
│   ├── project-smoke.mjs        # 64-check project/invitation/permission test
│   └── task-smoke.mjs           # 103-check task/permission/filter regression test
├── package.json                 # workspace scripts (run both apps at once)
├── .gitignore
└── README.md
```

## Prerequisites

- **Node.js ≥ 20** (tested on Node 26)
- **MongoDB** running locally on `mongodb://127.0.0.1:27017`, **or** a MongoDB Atlas URI

## Getting Started

### 1. Install dependencies

```bash
npm install            # installs concurrently at the root
npm run install:all    # installs backend + frontend deps
```

### 2. Configure environment

Environment files already exist for local development. Review them if needed:

- `backend/.env` — `PORT=4000` (5000 is taken by macOS AirPlay Receiver), `MONGODB_URI=mongodb://127.0.0.1:27017/workflow`, `CLIENT_URL=http://localhost:5173`, JWT/CSRF settings
- `frontend/.env` — `VITE_API_URL=/api`, `VITE_SOCKET_URL=http://localhost:4000`, `VITE_PROXY_TARGET=http://localhost:4000`

To use MongoDB Atlas, set `MONGODB_URI` in `backend/.env` to your Atlas connection string.

### 3. Start the applications

**Option A — both at once (recommended):**

```bash
npm run dev
```

**Option B — in two terminals:**

```bash
# Terminal 1 — backend on http://localhost:4000
npm run dev:backend

# Terminal 2 — frontend on http://localhost:5173
npm run dev:frontend
```

Then open **http://localhost:5173**. The backend auto-restarts on changes (`node --watch`); the Vite dev server hot-reloads the frontend.

### 4. Verify everything works

- **Backend health check:** <http://localhost:4000/api/health>

  ```bash
  curl http://localhost:4000/api/health
  ```

  ```json
  {
    "success": true,
    "status": "OK",
    "message": "WorkFlow API is healthy",
    "database": { "state": "connected", "name": "workflow", "host": "127.0.0.1" },
    "realtime": { "socketIO": true }
  }
  ```

- **Frontend ⇄ backend:** the topbar shows a green **Live** badge polling `/api/health` (with the realtime Socket.IO status).
- **Dashboard:** sign in and every card on the dashboard — stats, charts, tasks, deadlines, activity — comes from `GET /api/dashboard/summary` (see below).

## Dashboard & Demo Data

### Endpoints

| Method | Route                     | Auth      | Description                                                  |
| ------ | ------------------------- | --------- | ------------------------------------------------------------ |
| GET    | `/api/dashboard/summary`  | Protected | Stats + weekly trend + project progress + panels in one call |
| GET    | `/api/dashboard/activity` | Protected | Recent activity feed (`?limit=8`, used by the bell menu)     |
| GET    | `/api/projects`           | Protected | All visible projects with real per-project task progress     |

### What's on the dashboard

- **Topbar:** WorkFlow logo + dark navy sidebar, search, live API status, **notifications bell** (real activity feed with a “new today” badge), and a **user profile menu** (name/email, Profile/Settings placeholders, log out).
- **Welcome message** with the signed-in user's first name and today's date.
- **Four stat cards** — Total Projects, Total Tasks, Completed Tasks, Overdue Tasks — computed by MongoDB aggregations (`backend/src/services/stats.js`), never hardcoded.
- **Charts:** per-project progress bars, a task-status donut (done / in-progress / to-do), and a 7-day “tasks completed” bar chart — all dependency-free SVG/Tailwind.
- **Panels:** Recent Projects, My Tasks (nearest deadline first), Upcoming Deadlines, Recent Activity.
- **States:** skeleton while loading, retry panel on errors, and friendly empty states (including a first-project call to action).

### Seeding demo data

```bash
cd backend
npm run seed -- --reset
```

Creates a demo workspace: **5 visible projects + 1 archived, 35 tasks (16 done, 4 overdue)**, teammates, and an activity feed.

**Demo login:** `demo@workflow.app` / `Demo@1234` → <http://localhost:5173/login>

The seed prints the exact numbers the dashboard should show (5 projects · 33 tasks in visible projects · 48% completed · 4 overdue).

## Project Management

### Endpoints

All routes require a session; state-changing requests also require the CSRF header.

| Method | Route                                    | Who            | Description                                        |
| ------ | ---------------------------------------- | -------------- | -------------------------------------------------- |
| GET    | `/api/projects`                          | Members        | All my projects with real task progress + `myRole` |
| POST   | `/api/projects`                          | Any signed-in  | Create a project (creator becomes owner)           |
| GET    | `/api/projects/:id`                     | Members        | Full detail: members, roles, progress              |
| PATCH  | `/api/projects/:id`                     | **Owner only** | Edit name, description, color, due date, status    |
| DELETE | `/api/projects/:id`                     | **Owner only** | Delete + cascade tasks, activity, invitations      |
| POST   | `/api/projects/:id/archive`             | **Owner only** | Archive (project becomes read-only)                |
| POST   | `/api/projects/:id/restore`             | **Owner only** | Restore archived → active                          |
| PATCH  | `/api/projects/:id/members/:userId`     | **Owner only** | Assign a role (`admin` / `editor` / `viewer`)      |
| DELETE | `/api/projects/:id/members/:userId`     | Owner / admin  | Remove a member (admins can't touch admins/owner)  |
| POST   | `/api/invitations`                      | Owner / admin  | Invite by email (`{ projectId, email, role }`)     |
| GET    | `/api/invitations?projectId=…`         | Owner / admin  | Pending invitations for a project                  |
| DELETE | `/api/invitations/:id`                 | Owner / admin  | Revoke a pending invitation                        |
| GET    | `/api/invitations/mine`                 | Invited user   | Pending invitations for my email                   |
| POST   | `/api/invitations/:id/accept`           | Invited user   | Accept → becomes a project member                  |
| POST   | `/api/invitations/:id/decline`          | Invited user   | Decline                                            |

### Permission model (`backend/src/utils/permissions.js`)

| Role   | View project | Edit settings / archive / delete | Invite & remove members | Assign roles |
| ------ | ------------ | -------------------------------- | ----------------------- | ------------ |
| owner  | ✅            | ✅                                | ✅                       | ✅            |
| admin  | ✅            | ❌                                | ✅ †                     | ❌            |
| editor | ✅            | ❌                                | ❌                       | ❌            |
| viewer | ✅            | ❌                                | ❌                       | ❌            |

† admins can only invite, remove, and act on editors & viewers — never admins or the owner.

- **Private data:** every project query is scoped to `members.user = me`; non-members receive **404** (not 403) on read *and* write so project existence is never leaked.
- **Archived projects** are read-only for everyone except the owner (restore/delete).
- **Invitations** are tied to an email address: only the account whose email matches may accept/decline, they expire after 7 days, and one pending invitation per project+email (re-sending refreshes it). Emails go out via `sendEmail` (console fallback in dev).

### Frontend

- **Projects page** — invitation banner (accept/decline), search box, status filters with counts, create/edit dialog (name, description, color swatches, due date), ⋯ menu (edit / archive / restore / delete with confirm), progress bar, member avatars.
- **Project detail page** (`/projects/:id`) — overview with progress + task stats, **Members card** (owner-only role selects, permission-aware remove with confirmation), **Invitations card** (invite by email + role, pending list with revoke), owner-only edit/archive/delete.
- **Design:** new `Modal` and `ConfirmDialog` primitives reuse the existing tokens (rounded panels, indigo→blue gradient, Lucide icons).

## Task Management

### Endpoints

All routes require a session; state-changing requests also require the CSRF header.

| Method | Route                                   | Who                        | Description                                          |
| ------ | --------------------------------------- | -------------------------- | ---------------------------------------------------- |
| GET    | `/api/tasks`                            | Members                    | List: `?q= &projectId= &status= &priority= &assignee=me\|none\|id &label= &sort= &order=` |
| POST   | `/api/tasks`                            | Editor+                    | Create (`projectId`, `title`, `assignee` = member)   |
| GET    | `/api/tasks/:id`                        | Members                    | Full detail incl. project members (assignee picker)  |
| PATCH  | `/api/tasks/:id`                        | Editor+                    | Title, description, priority, assignee, dates, labels |
| PATCH  | `/api/tasks/:id/status`                 | Editor+ **or assignee**    | `{ status }` — sets/clears `completedAt`             |
| DELETE | `/api/tasks/:id`                        | Editor+                    | Delete task (subtasks & attachments go with it)      |
| POST   | `/api/tasks/:id/subtasks`               | Editor+ **or assignee**    | Add a subtask (max 50)                               |
| PATCH  | `/api/tasks/:id/subtasks/:subId`        | Editor+ **or assignee**    | Complete/incomplete or retitle a subtask             |
| DELETE | `/api/tasks/:id/subtasks/:subId`        | Editor+ **or assignee**    | Remove a subtask                                     |
| POST   | `/api/tasks/:id/attachments`            | Editor+ **or assignee**    | Add a link attachment (`url` http(s), optional `name`, max 20) |
| POST   | `/api/tasks/:id/attachments/upload`     | Editor+ **or assignee**    | Multipart file upload (8 MB cap, extension allowlist) |
| DELETE | `/api/tasks/:id/attachments/:attachmentId` | Editor+                 | Remove an attachment (uploads are unlinked from disk) |
| GET    | `/api/tasks/:id/activity`               | Members                    | Activity history, newest first (limit ≤ 200)          |

**List behaviour** — search (`q`, title + description, regex-escaped), filters (`status`, `priority`, `assignee`, `label`, `projectId`), and sort (`due` | `priority` | `created` | `updated` | `title`, `order=asc|desc`). Due dates always sort nulls-last; priority sorts low→urgent (asc) / urgent→low (desc). The global list only spans **non-archived** projects (an explicit `projectId` still reads archived ones — read-only); archived-project tasks are hidden from every other user's global list. Limit 500.

### Permission model (mirrors the project roles + task assignment)

| Operation                          | owner/admin | editor | viewer               | non-member |
| ---------------------------------- | ----------- | ------ | -------------------- | ---------- |
| View list/detail                   | ✅           | ✅      | ✅                   | **404**      |
| Create / edit / delete / reassign  | ✅           | ✅      | ❌ **403**               | **404**      |
| Attach files/links (add)           | ✅           | ✅      | ✅ **only own assigned task** | **404** |
| Remove attachments                 | ✅           | ✅      | ❌ **403**               | **404**      |
| Status + subtasks                  | ✅           | ✅      | ✅ **only own assigned task** | **404** |
| Anything in an archived project    | **409**         | **409**  | **409**                 | **404**      |

- **Membership first:** every operation loads the task through its project membership — non-members get **404** on read *and* write, so private tasks never leak their existence.
- **Assignee must be a project member** (else 400); labels are trimmed/lowercased/deduped (max 10 × 24 chars); `startDate ≤ dueDate` enforced both sides.
- **`completedAt`** is maintained on status changes (`updateOne` bypasses the pre-save hook, so the controller sets it explicitly).

### Frontend (`/tasks` — sidebar “My Tasks”)

- **Task list** — server-side search (debounced), status pills, priority/assignee/label/project filters, sort select (deadline, priority, created, updated, title) with an asc/desc toggle, and per-row permission-aware controls: status toggle (editors or the assignee), hover edit/delete, labels, subtask progress, attachment count, priority badge, due-date chip (overdue/today tones), assignee avatar.
- **Create/edit dialog** — every field: project (immutable after creation), title, description, priority, status, assignee (project members only), start/due dates with client-side mirror validation, and a chips-style label editor (Enter to add, lowercase, max 10).
- **Detail dialog** — description + inline editors for status/priority/assignee/dates, **subtask** add/complete/remove with a progress bar, **attachments** (paperclip file upload or URL link, add/remove/open, size + type hints), a **threaded discussion**, an **activity timeline**, and edit/delete actions gated by role. Viewers see everything read-only except progress on their own assigned task.
- **States** — skeleton rows while loading, retry panel on errors, empty states for “no tasks yet” vs “no matches”, delete confirmation, and a page-level error banner for failed actions.

## Task Collaboration (discussion + history)

Every task detail dialog carries a **discussion** and an **activity timeline**, fed by two new store-backed pieces of MongoDB data.

### Comments (threaded, embedded on the task doc)

| Method | Route                              | Who               | Description                                                        |
| ------ | ---------------------------------- | ----------------- | ------------------------------------------------------------------ |
| POST   | `/api/tasks/:id/comments`          | Any member        | `{ text ≤ 2000, parentId? }` — replies must reference a top-level comment of the same task (one nesting level). Max 100 comments per task. |
| PATCH  | `/api/tasks/:id/comments/:commentId` | Author only     | Edit own comment — sets `editedAt` (shown as “(edited)”).          |
| DELETE | `/api/tasks/:id/comments/:commentId` | Author **or editor+** | Delete a comment; deleting a top-level comment cascades to its replies. |

- Comments live in an embedded `comments` array with the author populated (`name`), so list rows and detail dialogs render avatars + names without extra calls.
- **Avatars** are initials in a brand gradient; timestamps show relative time with the absolute time on hover.

### Attachments (files, not just links)

- `POST /tasks/:id/attachments/upload` accepts `multipart/form-data` (`multer` disk storage → `backend/uploads/`, gitignored). Random 32-hex filenames + extension allowlist (no HTML/SVG/JS), 8 MB cap; the URL stored on the task is `/uploads/<file>` and is served statically — the unguessable random name is the access control.
- Deleting an uploaded attachment also unlinks the file from disk (best effort).
- Editors+ **or the task’s assignee** can add files/links; removing stays editor+.

### Activity history (`Activity` model)

Every meaningful change is recorded (newest first): `task-created`, `task-updated` (changed fields), `task-status` (from → to), `task-assigned`/`task-unassigned` (assignee names), `comment-added`/`comment-edited`/`comment-deleted` (first 120 chars as summary) and `attachment-added`/`attachment-removed`. Rows carry the **actor** and never block the action that caused them (history writes are best-effort); history dies with the task. The UI shows who created/updated the task, status transitions and assignments with icons + relative times.

### Permission checks (all collaboration endpoints)

- Every endpoint loads the task through project membership — **non-members get 404** (history and comments can’t leak).
- Comment add: any member incl. **viewers**; edit: author only (even owners can’t edit others’); delete: author or editor+.
- Archived projects answer **409** on comment add/edit/delete and on uploads.

### Testing

```bash
npm run test:board                               # direct → :4000/api
API_URL=http://localhost:5173 npm run test:board # through the Vite proxy
```

75 checks cover the board + collaboration modules: kanban ordering and cross-column moves, threaded comments (reply nesting, author-only edit, parent delete cascade), multipart uploads (`/uploads` static fetch, viewer 403, assignee allowed, disallowed type → 400, > 8 MB → 400, unlink-on-delete), the full activity record set, non-member 404s, archived 409s, and CSRF enforcement. All green.

```bash
cd backend && npm run seed -- --reset            # demo data for all suites
```

## How Frontend and Backend Connect

1. The frontend calls relative URLs like `/api/health` through the shared axios instance (`src/api/client.js`, base URL from `VITE_API_URL`).
2. Vite’s dev server **proxies** `/api` and `/socket.io` to `VITE_PROXY_TARGET` (the Express server), so no CORS issues arise in development.
3. The backend also enables CORS for `CLIENT_URL` (`http://localhost:5173`), so the same API works when called directly or from a production build.
4. `SocketContext` maintains one Socket.IO connection app-wide (same-origin through the proxy, so auth cookies ride along); board rooms (`room:join`) are ready for the realtime features.

## Authentication

### Endpoints

| Method | Route                      | Auth      | Description                                          |
| ------ | -------------------------- | --------- | ---------------------------------------------------- |
| GET    | `/api/auth/csrf`           | Public    | Issues the JS-readable `wf_csrf` cookie (CSRF token) |
| POST   | `/api/auth/signup`         | Public    | Creates the account (bcrypt) and logs the user in    |
| POST   | `/api/auth/login`          | Public    | Email + password → sets HTTP-only JWT cookies        |
| GET    | `/api/auth/me`             | Protected | Current user for the session (fresh from MongoDB)    |
| POST   | `/api/auth/refresh`        | Refresh   | Rotates the access + refresh cookie pair             |
| POST   | `/api/auth/logout`         | Session   | Clears both auth cookies                             |
| POST   | `/api/auth/forgot-password`| Public    | Emails a single-use reset link (10 min validity)     |
| POST   | `/api/auth/reset-password` | Public    | Sets a new password, invalidates all sessions        |

### How it works

- **Passwords** are hashed with **bcrypt** (12 rounds) in a Mongoose `pre("save")` hook. The `password` field is `select: false`, stripped by `toJSON`, and never appears in any response or log.
- **JWTs travel only in HTTP-only cookies** (`wf_at` 15 min, `wf_rt` 7 days). JavaScript can never read them; the frontend only sees the user object. The refresh token is rotated on every `/auth/refresh`, and `tokenVersion` on the user invalidates all sessions after a password reset.
- **Silent refresh:** when an API call returns 401, axios refreshes the pair once and retries the request transparently — users stay logged in across token expiry.
- **CSRF:** double-submit pattern — `/auth/csrf` issues a random token in a non-HTTP-only cookie; every POST/PUT/PATCH/DELETE must echo it in `X-CSRF-Token`, and the guard also rejects foreign `Origin` headers. Combined with `SameSite` cookies, cross-site form posts are blocked.
- **CORS:** explicit origin allow-list (`CLIENT_URL` + localhost dev origins) with `credentials: true`; in dev everything is same-origin through the Vite proxy anyway.
- **No user enumeration:** unknown email and wrong password return the identical `Invalid email or password.` message; forgot-password always answers generically, only including a dev reset link when no SMTP is configured and outside production.
- **Reset tokens** are 32 random bytes; only their SHA-256 hash is stored, they expire in 10 minutes, are single-use, and reset bumps `tokenVersion` to kill every existing session.

### Frontend

- `/login`, `/signup`, `/forgot-password`, `/reset-password` — split-screen auth pages with inline validation (messages identical to the backend rules), show/hide password, error banners, and loading states.
- `ProtectedRoute` guards the app shell (redirects to `/login`, remembering where you were headed); `GuestRoute` keeps logged-in users off the auth pages.
- `AuthProvider` hydrates the session from `/api/auth/me` on boot; logout lives in the topbar’s user menu. The sidebar and dashboard greet the real signed-in user.

### Testing the auth flow

```bash
# with the backend running (optionally the frontend too):
npm run test:auth                                  # direct → :4000/api
API_URL=http://localhost:5173 npm run test:auth    # through the Vite proxy
```

33 checks cover: CSRF issuance + enforcement, registration, duplicate email, generic login errors, protected access (missing/tampered/valid cookies), token refresh, forgot/reset (including single-use + old-password-rejected), logout, and validation errors. All green. 

```bash
npm run test:projects                               # direct → :4000/api
API_URL=http://localhost:5173 npm run test:projects # through the Vite proxy
```

64 checks cover the project module: CRUD + validation, archive/restore (including archived-is-read-only), cascade delete, invitations (invite / refresh / self-invite / wrong-user / decline / revoke / expiry conflicts), and the full permission matrix — owner vs admin vs editor vs viewer vs non-member, with non-members getting 404 everywhere so private project data never leaks. All green (requires seeded demo data: `cd backend && npm run seed -- --reset`).

```bash
npm run test:tasks                               # direct → :4000/api
API_URL=http://localhost:5173 npm run test:tasks # through the Vite proxy
```

103 checks cover the task module: full-field create (label normalisation, date-order and assignee validation), read/list isolation, every filter + search + both sort directions, field edits by owner/editor vs viewer vs non-member, the assignee-progress rule (a viewer assigned a task can update its status/subtasks but nothing else), link attachments, delete permissions, archived-project 409s on all six mutations, CSRF enforcement, and fixture cleanup. All green.

## Design System

Tokens live in `frontend/src/styles/index.css` under Tailwind v4’s `@theme` — each token becomes a utility class:

- **Brand (indigo)** `brand-50…950` → primary buttons, links, accents
- **Accent (blue)** `accent-50…900` → gradients and highlights
- **Navy** `navy-950…500` → dark sidebar (`from-navy-900 to-navy-950`)
- **Elevation** `shadow-soft`, `shadow-card`, `shadow-elevated`, `shadow-glow`
- **Radii** `rounded-card` (1rem), `rounded-panel` (1.25rem)
- **Motion** `animate-fade-in`, `animate-slide-up`
- **Typography** Inter (loaded in `index.html`)

## Roadmap

- [x] Phase 1 — structure, wiring, health check, design system
- [x] Phase 2 — JWT auth (signup/login/logout), bcrypt, cookies, CSRF, forgot/reset password
- [x] Phase 3 — dashboard: real statistics, charts, activity feed, notifications & profile menus, loading/empty/error states
- [x] Phase 4 — projects: CRUD, archive/restore, search & filter, member roles, email invitations (accept/decline/revoke)
- [x] Phase 5 — task management: full task fields (dates, labels, subtasks, attachments), CRUD, search/filter/sort, role + assignee permissions
- [x] Phase 6 — Kanban board: drag-and-drop ordering, cross-column moves, viewer/editor/assignee move rules
- [x] Phase 7 — task collaboration: threaded comments, edit/delete own comments, avatars + timestamps, file uploads, activity history (created/updated, status changes, assignments)
- [ ] Phase 8 — realtime collaboration via Socket.IO rooms, global search, settings, deployment

## License

MIT
