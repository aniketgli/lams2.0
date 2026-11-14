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
