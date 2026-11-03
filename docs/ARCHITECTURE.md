# Architecture and conventions

Where things live, and the rules that keep them there. A new file should have an obvious home; if it does not, this page is out of date.

## Folder map

```
server.ts               Launcher for `npm run dev` / `npm start` (starts server/server.ts under tsx)
server/                 Backend (Express + MySQL)
  server.ts             Start-up: HTTP server, report scheduler, graceful shutdown, process error handlers
  app.ts                Builds the Express app: middleware order, session store, route mounting
  config/               Settings. env.config.ts is the ONLY place that reads environment variables
  middleware/           Cross-cutting request steps: auth, security headers, CSRF, compression, error handler
  auth/                 Sign-in, sessions, account checks, module/role selection (routes + services)
  <feature>/            One folder per business area: attendance, leave, outdoorDuty, manualAttendance,
                        holidays, employees, masters, reports, notifications, dashboard, downloads
    <feature>.routes.ts   HTTP only: parse + validate input, call the store, shape the response
    store.ts / *.ts       Business rules and SQL for that area (no Express types)
  integrations/         Outside systems (email, slack): service + controller + routes
  lib/                  Small shared utilities with no business meaning (validation, caches, SQL helpers, errors)
  types/                Type declarations (Express request extensions)
src/                    Frontend (React + Vite)
  main.tsx, App.tsx     Entry and top-level routing
  auth/                 Session context, idle timeout, login-related screens
  context/              App-wide state (AppContext)
  lobby/                Module lobby after sign-in
  modules/<module>/     One folder per portal module (hrms, pms, fms, finance, inventory)
    <area>/pages/         Screens (routed)
    <area>/components/    Pieces used by those screens
    <area>/<area>Api.ts   The only code that calls the server for that area
    <area>/utils/         Pure helpers for that area
  shared/               Used by more than one module
    components/ modals/ layout/ hooks/ services/ design-system/ types/
  db/                   Drizzle schema (src/db/schema.ts) and the MySQL pool (src/db/index.ts)
migrations/             SQL files, named YYYYMMDD_description.sql, safe to re-run
scripts/                Operator tools (npm run db:check)
docs/                   This page
```

### Dependency direction

`routes -> store -> lib / db`. A store never imports a route; `lib` never imports a feature.
On the client: `pages -> components -> shared`, and screens talk to the server only through their `*Api.ts`.
Business rules are decided on the server; the browser only mirrors them to help the user (every validation is repeated server-side).

## Environment variables and secrets

- Read them only through `envConfig` (`server/config/env.config.ts`). A test fails if `process.env` appears anywhere else in `server/` or `src/`.
- Every variable is documented in `.env.example`; a test fails if one is missing. `.env` itself is git-ignored.
- Secrets (`DATABASE_URL`, `SESSION_SECRET`, SMTP password) never appear in logs, responses or client code.

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| React component / page file | `PascalCase.tsx`, one main component per file | `LeaveRequestsView.tsx` |
| Hook | `useCamelCase.ts` | `useTablePagination.ts` |
| Other TypeScript file | `camelCase.ts`; role suffix after a dot | `leave.routes.ts`, `access.service.ts`, `email.types.ts`, `ttlCache.test.ts` |
| Tests | next to the file, `<name>.test.ts` | `visibility.test.ts` |
| Functions / variables | `camelCase`, verbs for actions (`loadPunches`, `applyLeave`) | |
| Types / interfaces / classes | `PascalCase` | `AccountRow` |
| Constants | `UPPER_SNAKE_CASE` only for true constants | `MAX_LIST_ROWS` |
| Database tables / columns | `snake_case` (the biometric `Attendance` table keeps its machine-software names) | `leave_requests.start_date` |
| API routes | lower-case, plural nouns, kebab-case | `/api/hrms/outdoor-duty` |
| Migrations | `YYYYMMDD_description.sql` | `20261129_scale_indexes.sql` |

## Error handling

- Server code throws `HttpError` (`badRequest`, `forbidden`, `notFound`, 409 for conflicts) with a message a person can act on, a stable `code`, and `details` keyed by form field for validation problems.
- Route handlers are wrapped in `asyncHandler`, so every failure reaches `middleware/errorHandler.ts`, which returns `{ message, code, details }`. Unknown errors are logged in full on the server and shown as a generic 500; SQL or stack traces never reach the browser.
- A busy database answers `503 BUSY` with `Retry-After` instead of hanging.
- Anything that must be all-or-nothing runs in `inTransaction`; side effects such as emails run after the commit and never fail the request.
- Process level: unhandled promise rejections are logged, an uncaught exception exits so the process manager restarts it, and SIGTERM/SIGINT drain requests before closing the database pool.
- Browser: `api()` turns failed responses into `ApiError`; forms show `details` under their fields; `ErrorBoundary` replaces a crashed screen with a reload message.

## Duplicate and dead code

- Shared SQL helpers live in `server/lib/sql.ts`, the auditor/administrator guards in `middleware/auth.middleware.ts`, list visibility in `lib/visibility.ts`. Before writing a helper, look there.
- Remove code that nothing uses instead of commenting it out. `tsc --noUnusedLocals` shows unused imports and variables.
- No seed or hard-coded business data: everything comes from the database.
