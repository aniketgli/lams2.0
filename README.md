# WII Enterprise Portal — LAMS 2.0 (HRMS)

Leave & Attendance Management for the Wildlife Institute of India, inside the WII Enterprise Suite lobby.

- **Frontend:** React 19, Vite, Tailwind 4 (`src/`)
- **Backend:** Express 4 + MySQL via Drizzle ORM (`server/`, schema in `src/db/schema.ts`)

## Setup

```bash
cp .env.example .env          # fill in DATABASE_URL and SESSION_SECRET
npm install
# Run any SQL files in migrations/ that have not been applied yet, e.g.
mysql lams_db < migrations/20261029_web_sessions.sql
npm run dev                   # http://localhost:3000
npm run lint                  # type-check
```

Production: `NODE_ENV=production`, `SESSION_SECRET` of 32+ characters, `npm run build`, then `npm start`. The server refuses to start in production without the secret or the `web_sessions` table.

## How sign-in and access work

```
Login ──► Lobby ──► Module (HRMS) ──► Dashboard for the active role
           ▲            │  role switch ─► Dashboard
           └── back ────┘
```

1. **Login** (`POST /api/auth/login`) accepts a biometric ID or email. Only accounts with `status = 'active'` and `valid_upto` today or later get a session. Repeated failures are rate-limited (10 per user ID and 30 per IP per 15 minutes).
2. **Lobby** shows only modules where the user has an **active** grant in `user_module_roles`.
3. **Entering a module** (`POST /api/access/module`) — the server picks the starting role (least-privileged first: User → Reporting Manager → HoD → Auditor → Administrator).
4. **Switching role** (`POST /api/access/active-role`) — only roles the user actively holds in that module are accepted. The UI always returns to the dashboard.
5. **Every API request** re-checks the account and the active role against the database (`requireAuth`). Deactivating a user, letting their validity lapse, or revoking a role takes effect on their next request.
6. **Idle and maximum time.** After `SESSION_IDLE_MINUTES` (default 15) without activity the session ends, with a one-minute warning first. Every session also ends `SESSION_MAX_HOURS` (default 8) after sign-in. Both limits are enforced by the server; background status checks don't count as activity.
7. **URLs never grant access.** Any address is resolved against the session (`src/auth/resolveRoute.ts`): signed out → `/login`, no module open → `/lobby`, a page the active role may not open → `/hrms/dashboard`. Page permissions are defined once in `src/modules/hrms/hrmsPages.ts` and used by both the router and the sidebar.
8. **Tabs and devices stay consistent.** Tabs in one browser share a session and sync instantly (sign-in, sign-out, role change). Every request carries the tab's current role; if it changed elsewhere, the server refuses the action (`409 CONTEXT_CHANGED`) and the tab reloads its role. Other devices have their own sessions and pick up deactivation or role revocation on their next request or within a minute.

All session state comes from one payload (`GET /api/auth/me`):

```json
{ "user": { "id", "biometricId", "name", "email" },
  "modules": [{ "moduleId": "hrms", "roles": ["general_staff", "administrator"] }],
  "activeModule": "hrms", "activeRole": "administrator",
  "limits": { "idleSeconds": 900, "expiresAt": "2026-10-29T15:30:00.000Z" } }
```

Nothing about identity or roles is stored in `localStorage`.

## Server conventions

| Concern | Where |
|---|---|
| Role and module names (single source of truth) | `server/lib/roles.ts` (client mirror: `src/auth/access.ts`) |
| Auth guards | `requireAuth`, `requireActiveRole(module, ...roles)` in `server/middleware/auth.middleware.ts` |
| Request validation | `Validator` in `server/lib/validate.ts`; never trust client-side checks |
| Errors | throw `HttpError` (`server/lib/http.ts`); responses are `{ message, code, details? }`, and 500s never leak internals |
| Async routes | wrap with `asyncHandler` so rejections reach the error handler |
| CSRF | same-origin check + JSON-only bodies on all non-GET `/api` calls (`server/middleware/security.ts`) |
| Sessions | MySQL table `web_sessions`; `destroyUserSessions(userId)` signs a user out everywhere |

Client code calls the API through `api()` in `src/shared/services/api.ts`, which raises `ApiError` and sends the user back to login when the session ends.
