# LAMS 2.0 (WII Portal): QA, Security Audit and Fix Report

| | |
|---|---|
| Date | 14 Nov 2026 |
| Code audited | `aniketgli/lams2.0` `main` @ `e10ffff` (Merge PR #246) |
| Fix branch | `qa/security-audit-fixes`, PR #247 |
| Final status | **NEEDS IMPROVEMENT**: the fixes are ready to merge, but most live, UI and database testing could not be run (see §7) |

> **How to read this report.** It uses three result types. **Executed** means a test was actually run and its result seen. **Code-verified** means the behaviour was traced through the source code but not run against a live server. **Blocked** means it could not be tested here. Nothing is marked as passed unless it was executed.

---

## 1. Application architecture summary

- **Runtime:** a single Node process (`server.ts` → `server/app.ts`). Express 4 serves the JSON API under `/api`. In production it also serves the Vite-built React 19 SPA from `dist/`; in development the Vite dev server runs as middleware.
- **Database:** MySQL `lams2_db` through `mysql2` pools (`src/db`). Drizzle is used for some reads and schema typing, and parameterised raw SQL for most stores. Sessions are stored in the `web_sessions` table (`server/lib/sessionStore.ts`).
- **Authentication:** email and password, limited to `@wii.gov.in` / `@edu.wii.gov.in`. Passwords are hashed with bcrypt (cost 12). Sign-in uses a server-side SVG CAPTCHA and is rate-limited per email (10 per 15 min) and per IP (30 per 15 min). The session ID is regenerated at login. An idle limit (15 min) and a maximum lifetime (8 h) are enforced on every request.
- **Authorization:** `users` combined with `user_module_roles`, resolved through `role_catalog` (DB-driven). Each catalog row maps to an *access role*: administrator, audit, reviewing_manager (HoD), reporting_manager, general_staff (User) or leave_balance_manager. The session holds one active module and one active role. `requireAuth` re-checks the account, its validity and the active grant on every request.
- **HRMS server modules:** employees and profiles, mapping, photos, bulk import, attendance (read-only biometric punches), manual attendance, outdoor duty, leave (types, groups, requests, balances and balance import, comp-off, RH, special leave, joining reports and certificates), holidays, masters, organization, email and SMTP settings, notification outbox, scheduled reports, dashboards, download audit, activity logs (auditor).
- **Not implemented yet:** PMS, Facility (FMS), Finance and Stock/Inventory. The UI shells exist, but there are no server routes.
- **Endpoints:** about 170 routes were found and reviewed (route list: `grep -rn "router\.(get|post|put|patch|delete)" server`).

## 2. Testing scope

| Area | What was done |
|---|---|
| Repository and working tree | Fresh clone of `main`, which is clean. The development PC (`D:\lams2.0`) was **not** connected, so any uncommitted work there was not seen and was not touched. |
| Static audit | Every route file, the auth and session middleware, the RBAC and role catalog, visibility rules, file uploads and downloads, SQL construction, error handling, security headers, CSRF and CAPTCHA |
| Automated tests | The existing Bun suite, plus 10 new regression tests, run locally and in GitHub Actions CI |
| Type check and production build | Run in CI (`bunx tsc --noEmit`, `bun run build`) |
| Live server `http://172.16.30.250:3000` | Page load only. API probing from the browser pane was blocked (see §7). |
| UI at 5 resolutions, Playwright, DB audit, performance, dependency CVEs | Blocked (see §7) |

## 3. Test case totals

| Category | Total | Passed | Failed → fixed | Blocked |
|---|---|---|---|---|
| Automated server unit tests (executed, after fixes) | 188 | 188 | n/a | 0 |
| Automated frontend unit tests (executed locally) | 15 | 14 | 0 | 1 (Table.test needs `react`, which is not installable offline here; CI does not run `src` tests) |
| Type check, CI (executed) | 1 | informational: 78 errors, all pre-existing, none in changed server code | n/a | n/a |
| Production build, CI (executed) | 1 | 1 (2042 modules, built in 6 s) | n/a | n/a |
| Audit test cases (table below) | 32 | 26 code-verified OK | 5 defects found and fixed (1 reproduced by execution) | 1 |
| Live server checks | 1 executed + 9 planned | 1 | 0 | 9 |

### Audit test cases

| ID | Test | Method | Result |
|---|---|---|---|
| AU-01 | Session ID regenerated on login (fixation) | Code | OK |
| AU-02 | Idle timeout and maximum lifetime enforced server-side on every request | Code + existing tests | OK |
| AU-03 | Inactive or expired accounts refused at login and on every later request | Code + `accountBlock.test` (executed) | OK |
| AU-04 | Wrong password and unknown email give the same message and timing (dummy bcrypt hash) | Code | OK |
| AU-05 | Empty or malformed credentials and wrong email domain return 400 | Code | OK |
| AU-06 | Login rate limit per email and per IP; CAPTCHA checked before the password | Code + `captcha.test` (executed) | OK; but see BUG-004 for the IP limit |
| AU-07 | Cookie `HttpOnly`, `SameSite=Strict`, `Secure` when HTTPS | Code | OK (the site is HTTP only; see R-02) |
| AU-08 | Logout destroys the session and clears the cookie | Code | OK |
| AU-09 | Password change: current password checked, policy applied, other sessions signed out | Code | OK |
| AU-10 | Deactivation or deletion signs the user out on every device | Code | OK |
| RB-01 | Role switch accepted only for DB grants of that module | Code | OK |
| RB-02 | Admin endpoints require the *active* HRMS administrator role | Code | OK |
| RB-03 | Auditor endpoints are read-only (`isAuditor` is GET only) | Code | OK |
| RB-04 | Administrator cannot change their own roles | Code | OK |
| RB-05 | Fixed system accounts cannot be edited or role-changed | Code + `systemAccounts.test` (executed) | OK |
| RB-06 | **HRMS data cannot be reached with another module's role** | Code + new test | **FAILED → BUG-001, fixed** |
| RB-07 | **Project history visible only to self, manager, admin or auditor** | Code | **FAILED → BUG-002, fixed** |
| RB-08 | Leave, OD and manual attendance rows filtered in SQL by viewer (IDOR) | Code + `visibility.test` (executed) | OK |
| RB-09 | Approve, forward and reject only by the right RM or HoD; not on one's own request; 10-minute undo | Code + `approvalFlow`/`undoWindow` tests (executed) | OK |
| AP-01 | All SQL parameterised; dynamic identifiers only from server-side definitions | Code (grep of every template-literal query) | OK |
| AP-02 | Malformed JSON returns 400, oversized body returns 413, unknown API returns JSON 404 | Code | OK |
| AP-03 | Internal errors hidden behind a generic 500 | Code | OK |
| AP-04 | State-changing requests must be JSON from the same origin (CSRF) | Code | OK |
| AP-05 | Slack notify cannot be used for SSRF (hooks.slack.com only, no redirects) | Code | OK |
| AP-06 | Uploads (photo, medical certificate, fitness PDF) typed by magic bytes, with size limits | Code | OK |
| AP-07 | **Downloads of uploaded files work for any file name** | Executed (Node HTTP) | **FAILED → BUG-003, fixed** |
| AP-08 | **Per-IP limits cannot be bypassed with X-Forwarded-For** | Code / config | **FAILED → BUG-004, fixed** |
| SE-01 | Security headers (nosniff, frame DENY, referrer, COOP, permissions) | Code | OK; no CSP (R-01) |
| SE-02 | API responses `Cache-Control: no-store` | Code | OK |
| SE-03 | Secrets in Git | `git grep` | OK; one test fixture DB URL to confirm (R-06) |
| CI-01 | **Test suite runs on any machine or CI** | Executed in CI | **FAILED → BUG-005, fixed** |
| DB-01 | Read-only audit of keys, FKs, orphans and duplicates in `users`, `user_module_roles` and `user_logs` | n/a | BLOCKED (no DB access) |

## 4. Bugs identified and fixed

### BUG-001: Cross-module role confusion lets another module's administrator act as HRMS administrator
- **Module:** RBAC / all HRMS self-service and approval routes
- **Files:** `server/{leave/leave,manualAttendance/manualAttendance,outdoorDuty/outdoorDuty,employees/employees,attendance/attendance,dashboard/dashboard}.routes.ts`; new `server/lib/hrmsViewer.ts`, re-exported from `server/middleware/auth.middleware.ts`
- **Severity:** **Critical** (vertical privilege escalation)
- **Description:** Role IDs are shared across modules. `role_catalog` maps *PMS Administrator*, *Store Administrator*, *Facility & Fleet Administrator* and *Finance Comptroller* to the access role `administrator`; *PI* and *Store Keeper* map to HoD and RM. HRMS routes guarded only by `requireAuth` built their viewer as `{ id, role: req.auth.activeRole }` without checking that HRMS was the active module. A user who held, for example, `pms_admin` could enter PMS, keep that session, and call HRMS endpoints directly as the HRMS administrator. They could list everyone's leave, OD, manual attendance and biometric attendance; read full employee profiles; set leave balances (`PUT /api/hrms/leave/balances`, import); approve or reject any request; apply, edit or delete on anyone's behalf; and see admin dashboards. The UI hides this, but the API allowed it.
- **Root cause:** The active role was used without the active module.
- **Fix:** `hrmsRoleOf(req)` returns the role only when `activeModule === 'hrms'`, otherwise `null`, which is the least privilege: own rows only, and no apply, approve or balance rights. All six route files now use `hrmsViewerOf(req)`. Routes guarded by `requireActiveRole('hrms', …)` were already correct.
- **Retest:** `server/lib/hrmsViewer.test.ts` (5 tests) checks that PMS, Stock, Facility and Finance administrator and manager roles resolve to no HRMS role and an own-rows-only visibility clause. It also includes a guard that fails if any `*.routes.ts` builds a viewer from the raw `activeRole`; it detects all 6 original files on `main`. **PASS.**

### BUG-002: IDOR in employee project and posting history
- **Module:** Employee profile
- **File:** `server/employees/employees.routes.ts` (`GET /api/hrms/employees/:biometricId/project-history`)
- **Severity:** **High** (horizontal access / personal data exposure)
- **Description:** Any signed-in user could read the full `user_histories` rows of any employee by trying 4-digit biometric IDs. Those rows include `pay`, `grant_amount`, `funding_agency`, PI name and email, and responsibilities. The business rule is: a User sees only their own profile, RM/HoD see their people, and the Administrator and Auditor see everyone.
- **Root cause:** The route checked only `isAuthenticated`.
- **Fix:** The route resolves the employee and then calls the existing `getEmployee(viewer, id)`, which applies `canSeeFullProfile`. It returns 404 for an unknown employee and 403 when the viewer may not see them. The legitimate caller (the profile page's history modal, opened by self, manager, admin or auditor) is unaffected.
- **Retest:** Code-verified. A DB-backed route test could not be run here (no database). **Recommended manual retest:** as a User, request another employee's history and expect 403.

### BUG-003: Medical or fitness certificate download fails (500) for non-Latin file names
- **Module:** Leave → medical certificate, joining fitness certificate
- **Files:** `server/leave/leave.routes.ts`, `server/lib/http.ts` (new `attachmentDisposition`)
- **Severity:** Medium (functional)
- **Description:** The uploaded file name is kept, for example a Hindi or emoji name. On download, `res.setHeader('Content-Disposition', 'attachment; filename="<name>"')` throws `ERR_INVALID_CHAR`, so the approver gets "Something went wrong on the server".
- **Reproduced:** Yes, executed. A Node HTTP server given `filename="प्रमाणपत्र.pdf"` returned `500 ERR_INVALID_CHAR`.
- **Fix:** The header now has an ASCII `filename` (falling back to `certificate.pdf`) plus an RFC 6266 `filename*=UTF-8''…` carrying the real name. Quotes and line breaks are stripped.
- **Retest:** `server/lib/attachmentDisposition.test.ts` (3 tests, real HTTP round trip): Hindi name returns 200, ASCII names are unchanged, and header injection is not possible. **PASS.**

### BUG-004: `trust proxy` enabled with no proxy, so per-IP limits can be bypassed
- **Module:** Authentication / rate limiting
- **Files:** `server/app.ts`, new `server/config/proxy.config.ts`, `.env.example`
- **Severity:** Medium
- **Description:** In production, `app.set('trust proxy', 1)` was set, but the portal is opened directly at `:3000` with no reverse proxy. Express therefore took `req.ip` from the client-supplied `X-Forwarded-For`. A script could send a new value on every attempt and never hit the 30-per-IP sign-in limit or the 60-per-IP CAPTCHA issuance limit. The per-email limit still applied.
- **Fix:** Forwarded headers are not trusted unless `TRUST_PROXY` is set (`1` when nginx or another proxy is added later).
- **Retest:** `server/config/proxy.config.test.ts` (2 tests). **PASS.**
- **Deployment note:** If a reverse proxy is ever placed in front of the portal, set `TRUST_PROXY=1` in the server `.env`.

### BUG-005: CI red on `main`, because two test files hard-coded `/home/claude/lams2.0/…`
- **Module:** Test infrastructure
- **Files:** `server/dashboard/dashboard.test.ts`, `server/leave/groups.test.ts`
- **Severity:** Low (but it hid everything after it: CI never reached the type check or build on `main`)
- **Fix:** Module paths are now built from `import.meta.url`.
- **Retest:** The suite was run from a different directory (188/188) and in GitHub Actions: **Unit tests ✓, Type check ✓ (informational), Production build ✓.**

Also corrected: a stale comment in `server/middleware/security.ts` (the cookie is SameSite=Strict, not Lax).

## 5. Bugs and risks requiring approval (not changed)

| ID | Severity | Item | Why not fixed here |
|---|---|---|---|
| R-01 | Medium | No `Content-Security-Policy` header for the SPA | A CSP has to be tested against the live UI (inline styles, `data:` logos and photos). Needs a test pass in a browser. |
| R-02 | Medium | The portal is served over plain HTTP on the LAN, so passwords and session cookies cross the network unencrypted | Infrastructure change: TLS on the Ubuntu server (nginx + internal certificate). After that, set `TRUST_PROXY=1`. |
| R-03 | Low | The per-email lockout (10 per 15 min) lets anyone on the LAN temporarily lock out a known colleague's sign-in | Design trade-off. Options: CAPTCHA-only after N attempts, or per-email+IP keys. Needs your decision. |
| R-04 | Low | Rate-limit and CAPTCHA nonce stores are in memory, per process | Fine for one process. Move them to MySQL if you run several. |
| R-05 | Low | 78 TypeScript errors (mostly `unknown` in frontend filter code, `bun:test` typings, and `EmployeeProfilePage.local-preserve.tsx`) | Pre-existing, CI-informational, no runtime effect seen. A separate clean-up PR is suggested. |
| R-06 | Low | `src/db/connection.test.ts` contains `lams2_app:Pa%40ss%231@172.16.30.250` | Please confirm this is not the real `lams2_app` password. If it is, rotate it. |
| R-07 | Info | `EmployeeProfilePage.local-preserve.tsx` (396 KB) and `package-lock.json.backup` / `server.ts.backup` are committed at the repo root | Deleting files needs your approval. |
| R-08 | Info | The directory list (`GET /api/hrms/employees`) shows every user the name, email, department and roles of all staff (with sensitive fields blanked) | Looks intended for pickers and avatars. Confirm. |

## 6. Security and performance findings (summary)

- **Security posture:** Strong overall. All authorization is server-side, rows are filtered in SQL, SQL is parameterised, error output is generic, sessions are DB-backed with idle and maximum limits, and grants are re-checked on every request. Uploads are typed by content, the Slack webhook is allowlisted, system accounts are protected and every change is audited. The two access-control gaps (BUG-001, BUG-002) are fixed.
- **Performance:** The only executed measurement is that the live production bundle loads with DOMContentLoaded at about 257 ms and a 1.4 KB HTML transfer. The production build (`index` + `vendor` chunks) completed in 6 s in CI. API, DB-query and rendering timings were blocked. In code, list queries are capped at 20,000 rows, SELECTs have a MySQL time limit (`DB_QUERY_TIMEOUT_MS`), and reference data uses a TTL cache.
- **Dependencies:** `npm audit` / `bun audit` could not run (no registry access from this workspace). Please run `npm audit --omit=dev` on the PC.

## 7. Limitations and untested features (blocked)

1. **Live server:** The built-in browser pane on your PC asked for approval on every action and blocked the page's own `fetch` calls. So only the page load was verified. Unauthenticated API probing, header inspection, login negative cases and every role walkthrough were not run.
2. **No credentials or test accounts** were provided, and none were created (rule 7). End-to-end CRUD, approval flows, exports and notification emails were not executed.
3. **No database access:** The MySQL server is on the LAN and not reachable from the cloud workspace. The read-only audit of keys, foreign keys, orphans and duplicates in `users`, `user_module_roles` and `user_logs` was not run. Suggested read-only queries:
   ```sql
   SELECT biometric_id, COUNT(*) FROM users GROUP BY biometric_id HAVING COUNT(*) > 1;
   SELECT r.* FROM user_module_roles r LEFT JOIN users u ON u.biometric_id = r.biometric_id WHERE u.id IS NULL;
   SELECT biometric_id, module_id, role_id, COUNT(*) FROM user_module_roles WHERE status = 'active' GROUP BY 1,2,3 HAVING COUNT(*) > 1;
   SELECT u.email, r.module_id, r.role_id FROM user_module_roles r JOIN users u ON u.biometric_id = r.biometric_id
    WHERE r.status = 'active' AND r.module_id <> 'hrms';   -- users who could exploit BUG-001 until it is deployed
   ```
4. **UI and responsive testing** at 1920×1080, 1366×768, 1024×768, 768×1024 and 390×844, and **Playwright**: not run. Playwright is not a project dependency and packages cannot be installed offline here.
5. **Development PC working tree** (`D:\lams2.0`) not inspected; no folder was connected.

## 8. Files modified (PR #247)

`server/lib/hrmsViewer.ts` (new), `server/middleware/auth.middleware.ts`, `server/{attendance,dashboard,employees,leave,manualAttendance,outdoorDuty}/*.routes.ts`, `server/lib/http.ts`, `server/config/proxy.config.ts` (new), `server/app.ts`, `server/middleware/security.ts` (comment), `.env.example`; tests: `server/lib/hrmsViewer.test.ts`, `server/lib/attachmentDisposition.test.ts`, `server/config/proxy.config.test.ts` (new), `server/dashboard/dashboard.test.ts`, `server/leave/groups.test.ts`; this report.

No schema, migration or data changes. No new dependencies. No server configuration was touched.

## 9. Tests executed after fixes

- `bun test server`: **188 pass, 0 fail** (local, and from a second checkout path)
- GitHub Actions on PR #247: **bun install ✓ · Unit tests ✓ · Type check ✓ (informational, pre-existing errors) · Production build ✓**

## 10. Remaining risks

Until PR #247 is merged **and the Ubuntu server is updated and restarted**, BUG-001 and BUG-002 remain open on the live portal. Run the last query in §7 to see which accounts hold non-HRMS roles. R-01 and R-02 are the main hardening items left.

## 11. Deployment readiness

**NEEDS IMPROVEMENT.** The code changes are small, covered by tests and build cleanly, and are safe to deploy. A **PASS** rating needs the blocked items in §7 to be run: a role-by-role walkthrough with test accounts, the read-only DB queries, and the responsive UI check.

After merging, on the server: `git pull`, `npm ci`, `npm run build`, restart the service. No `.env` change is needed unless a reverse proxy is in use (`TRUST_PROXY`).

---

# Part 2: Cleanup, hardening and penetration test (14 Nov 2026, PR #248)

## 12. Penetration test of a running instance (executed)

`scripts/security/pentest.ts` attacks a **real running portal**. It runs in GitHub Actions (`.github/workflows/security.yml`) against a throw-away MySQL 8 database: the schema is built from `schema.ts` plus every migration, and 11 test accounts are seeded. It never touches the live server or `lams2_db`, and the script refuses any target other than localhost. It now runs on every pull request.

**Result: 54 of 54 attack checks passed. No request produced a server error.**

| Area | What was attacked | Result |
|---|---|---|
| Headers / info leak | Security headers, `X-Powered-By`, caching, `/.env`, `/.git/HEAD`, source files, unknown routes | PASS |
| Authentication | All 14 protected endpoints without a session; wrong password vs unknown user; wrong domain; empty login; SQL and NoSQL injection in login; inactive and expired accounts | PASS |
| Sessions | Session fixation; HttpOnly and SameSite=Strict cookie; replaying a cookie after logout; forged cookie | PASS |
| Default password | The fixed Administrator account signed in with `123456` can do nothing except change the password (new gate) | PASS |
| Vertical escalation | 9 administrator endpoints called as a User; self-promotion to Administrator; entering a module that wasn't granted; a PMS administrator calling HRMS endpoints (fixed in PR #247) | PASS |
| IDOR | Another employee's profile, full profile and project history; another team's manager approving; a colleague editing or deleting a request | PASS |
| Auditor | Can read logs but not write | PASS |
| Business flow (OD) | Apply; apply on someone else's behalf; approve own request; the right RM approves; edit after approval; undo once and not twice; delete; applications older than 15 days; end date before start date | PASS |
| CSRF | Cross-origin POST; form-encoded POST | PASS |
| Input | Malformed JSON; 3 MB body; wrong data types; huge or SQL-shaped IDs; path traversal; SQL in filters; stored XSS payload | PASS |
| Uploads | Photo: HTML posing as PNG, SVG, over 512 KB. Logo: SVG, fake PNG, over 1 MB. Oversized employee CSV | PASS |
| Rate limits | Password guessing (blocked on attempt 11); password spraying with forged X-Forwarded-For (blocked); heavy actions (blocked); writes per account (blocked) | PASS |

## 13. Findings and fixes in Part 2

| ID | Severity | Finding | Fix |
|---|---|---|---|
| BUG-006 | **Critical** | The fixed **Administrator (erp@wii.gov.in) and Auditor accounts are created with password `123456`**, published in `migrations/20261120_bootstrap_users.sql`. The change was skippable, and the server never enforced `must_change_password`. Anyone on the LAN could sign in as Administrator if the password was never changed. | Until a system account replaces its default password, the server allows only `/auth/me`, `/auth/change-password` and `/auth/logout`. Skipping is refused, and the UI hides "Skip" for these accounts. Employees can still skip, as you decided. Test: `passwordGate.test.ts` + pentest A-11. **Run `npm run db:audit` on the server: if it reports "System accounts still on their default password", change those passwords today.** |
| BUG-007 | Medium | No general API rate limit. Any signed-in script could flood writes, imports, SMTP tests, report sends or email resends. | Per-IP limit of 1200 requests per minute for the whole API. Per-account limit of 60 changes per minute. Separate 10-minute limits for bulk imports, SMTP tests, report "send now", email resend, photo upload and admin password reset. Configurable with `API_RATE_PER_MINUTE` and `API_WRITES_PER_MINUTE`. Test: `apiRateLimit.test.ts` + pentest R-03/R-04. |
| BUG-008 | Medium | Logo upload checked only the `data:image/png` label, not the file content, and allowed 2 MB. A 2 MB logo is about 2.7 MB as text, which is over the 2 MB request limit, so large logos failed with a generic 413. | The real type is checked from the file's bytes, the limit is 1 MB, and the UI text was updated. Test: `logoRules.test.ts` + pentest U-02. |
| BUG-009 | Low | The employee import allowed a 2,000,000-character CSV, which can exceed the 2 MB request limit after JSON escaping. | Limit set to 1,000,000 characters (the 300-row cap is unchanged). |
| BUG-010 | Low | A custom password reset compared the two password fields only in the browser. | The server now checks `confirmPassword`. |
| VAL-01 | n/a | Client-side validation found in Employee add/edit (live hints and the "Mandatory fields" block), Master records, password reset and the delete-reason check. | Removed. The server already validates every one of these and the forms show its field errors. Kept in the browser: the file-size pre-check before a certificate or photo is read. It stops the browser from reading a 50 MB file; the server enforces the same limit. |
| DB-02 | Medium | 5 legacy tables (`sessions`, `profile_master_records`, and 3 old master audit-log tables) are no longer used. Their data was copied forward by earlier migrations. | `migrations/20261212_retire_legacy_tables.sql` first checks that nothing is missing, then **renames** them to `zz_retired_*`. It does not drop anything and can be undone. Not run on your database: you run it after a backup. Also removed from `schema.ts`. |
| DB-03 | Low | The migrations cannot build a fresh database in file-name order (`20261031_leave_policy_*` alters `leave_types` before `20261031_leave_types.sql` creates it). The old `src/db/migrations` files reference `lams2_db` and `user_id` columns that no longer exist. | Documented. The security workflow applies them in 3 passes. No change to the existing database. |
| DB-04 | Low | `schema.ts` declares `timestamp(3) ... ON UPDATE` columns that `drizzle-kit` turns into invalid SQL. | Documented. **Never run `drizzle-kit push` on the live database.** A note was added at the top of `schema.ts`. |
| DEP-01 | Medium | `package-lock.json` was out of sync with `package.json`: `drizzle-orm`, `mysql2`, `bcrypt` and `express-session` were missing, so `npm ci` could not work. | Regenerated. **No installed version changed** (checked package by package); only the unused packages were removed. |

## 14. Unused code and files removed (18 files, about 16,000 lines)

- **Root clutter:** `EmployeeProfilePage.local-preserve.tsx` (396 KB), `package-lock.json.backup`, `server.ts.backup`, `metadata.json` (Google AI Studio), `.aistudio/` planning notes.
- **Dead Slack feature:** nothing could open the Slack hub modal. Removed the frontend modal, the service, the state and its localStorage config, and the server route `POST /api/slack/notify`, which also removes some attack surface.
- **Old entry point and shim:** `server/server.ts` (superseded by the root `server.ts`) and `server/leave/undoWindow.ts` (its test now imports `approvalFlow`).
- **Unused UI components:** `DatePicker`, `TimePicker`, `StateFeedback` and `FileUpload` wrappers. Every picker in the app uses `AppDatePicker` / `AppTimePicker`.
- **Unused functions and types:** `entitledQuota`, `isPwdUser`, `groupLeaveTypeIdsOfUser`, `listRecipients`, `startStatus`, `DESIGNATION_LAYOUTS`, `SmtpConfigPayload`, `formatTime24to12`, `evaluateAttendanceByShift`, `userHasRole`, `userHasModuleRole`, `isDayOff`, `fetchAudit`, the Slack and email-config types.
- **Unused dependencies:** `@google/genai`, `motion`, `recharts`, `autoprefixer`, `esbuild`.
- **Kept on purpose:** the PMS, Finance, Facility and Inventory screens (planned modules); design-system pieces such as `CardHeader` and `AlertDialog`; the `attendance_punches` schema entry (the vendor's `Attendance` table).

## 15. New tools

- `npm run db:audit`: a **read-only** database audit. It reports unused tables, tables without a primary key, orphan role grants, duplicate grants, accounts without profiles, profiles without accounts, requests of deleted users, broken manager links, duplicate emails and phones, expired-but-active accounts, and system accounts still on the default password.
- `scripts/security/pentest.ts` + `.github/workflows/security.yml`: the attack suite above. It runs on every PR.

## 16. Business logic

Checked in code and by executed flows. Correct:
- 15-day back-dating for leave, OD and manual attendance (server-side, India time zone)
- Edit and delete locked once approved or after the date
- No self-approval
- Only the employee's own RM can decide one-stage requests; RM forwards and HoD decides two-stage requests
- Undo once within 10 minutes (admin: any time)
- Row locks against double submission
- The administrator's date range compared with other roles

**Not yet tested end to end** (they need leave types, groups and balances set up): the leave engine rules (sandwich and holidays for 2-stage leaves, CL half day, comp-off validity and the 2-per-month cap, LTC encashment at 30 days or more, joining reports, paternity window). Their unit tests pass. Extending the security workflow with a leave-setup fixture is the next step.

## 17. Deployment steps for PR #248

1. Merge the PR, then on the server: `git pull`, `npm ci`, `npm run build`, restart.
2. `npm run db:audit`. Fix any **FAIL**, especially the system account passwords.
3. Optional, after `mysqldump`: `mysql> source migrations/20261212_retire_legacy_tables.sql`.
4. If you run more than one server process, or sit many users behind one NAT address, adjust `API_RATE_PER_MINUTE`.
