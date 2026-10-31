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
mysql lams_db < migrations/20261029_employee_profile_salutation.sql
mysql lams_db < migrations/20261029_master_settings.sql
mysql lams_db < migrations/20261029_notification_recipients.sql
mysql lams_db < migrations/20261029_email_settings.sql
mysql lams_db < migrations/20261029_password_policy.sql   # required: sign-in reads users.must_change_password
mysql lams_db < migrations/20261029_employee_photos.sql
mysql lams_db < migrations/20261030_institutes.sql
mysql lams_db < migrations/20261030_holidays.sql
mysql lams_db < migrations/20261030_holiday_types.sql
mysql lams_db < migrations/20261030_org_unit_type_project.sql
mysql lams_db < migrations/20261030_org_unit_mapping.sql
mysql lams_db < migrations/20261030_attendance_logs.sql   # biometric punches (Attendance table), filled by the machine software
mysql lams_db < migrations/20261030_manual_attendance.sql
mysql lams_db < migrations/20261030_manual_attendance_undo.sql
mysql lams_db < migrations/20261030_outdoor_duty.sql
mysql lams_db < migrations/20261031_leave_types.sql
mysql lams_db < migrations/20261031_leave_policy_rules.sql
mysql lams_db < migrations/20261031_leave_policy_debit.sql
mysql lams_db < migrations/20261031_leave_policy_pwd.sql
mysql lams_db < migrations/20261031_leave_requests.sql
npm run dev                   # http://localhost:3000
npm run lint                  # type-check
```

New employees get the HRMS "User" role only and the default password (set it in Master Settings → Organization; stored as a hash). They must choose their own password at first sign-in, and again after any administrator reset.

Production: `NODE_ENV=production`, `SESSION_SECRET` of 32+ characters, `npm run build`, then `npm start`. The server refuses to start in production without the secret or the `web_sessions` table.

## How sign-in and access work

```
Login ──► Lobby ──► Module (HRMS) ──► Dashboard for the active role
           ▲            │  role switch ─► Dashboard
           └── back ────┘
```

1. **Login** (`POST /api/auth/login`) accepts only an institute email on an allowed domain (`LOGIN_EMAIL_DOMAINS`, default `@wii.gov.in` and `@edu.wii.gov.in`, exact match). Only accounts with `status = 'active'` and `valid_upto` today or later get a session. Repeated failures are rate-limited (10 per user ID and 30 per IP per 15 minutes).
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

## Master Settings

Administrators manage masters; Auditors see the same screens read-only. Profile Masters include the employee-form lists.

- **Masters registry** (`server/masters/definitions.ts`): every simple master — profile masters (organizations, designations, categories, projects, courses, batches, streams, PhD enrollment) and employee-form lists (salutation, gender, employee type, unit type, cadre group, funding category) — is one entry. Routes, validation, dropdown options and usage checks all come from it.
- **Lists** live in `lookup_values`. Records store a list item's **code**, which never changes; the name can be edited freely.
- **Employee types** are admin-defined; each picks one fixed **form layout**, which decides the fields the employee form asks for.
- **In use = protected:** a master value used by employees or another master cannot be deleted, and profile masters in use cannot be renamed. Make them *Inactive* instead; they disappear from dropdowns but existing records keep them.
- **Audit:** every create / update / status change / delete (masters, shifts, biometric machines, organization settings, CC/BCC emails) is written to `master_audit_logs` in the same transaction, with who, role, when, before/after and an optional reason. The Auditor role's screens will read it (`GET /api/hrms/masters/audit`).
- **Email sender & server** (Organization tab, table `email_settings`): sender name, From and Reply-to addresses, SMTP server, port, security and sign-in; sending can be switched off. The SMTP password is encrypted (AES-256-GCM, key `SETTINGS_ENCRYPTION_KEY`) and never sent to the browser. Until saved, the `.env` SMTP values are used. Certificates are verified unless `SMTP_ALLOW_SELF_SIGNED=true`.
- **Email CC / BCC** (Organization tab, table `notification_recipients`): active addresses are added to every notification email. Emails with category `SECURITY` (password resets) are never copied.

API: `GET /api/hrms/masters/catalog`, `/options`, `/audit`, and `GET|POST /api/hrms/masters/:key`, `PUT|DELETE /:key/:id`, `PATCH /:key/:id/status`.

Migration: `migrations/20261029_master_settings.sql` (creates `master_audit_logs` and `lookup_values`, copies old audit history, seeds the lists).

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
