# Implementation Plan: LAMS 2.0 Phase 1 (Security Audit & Auth Foundation)

## Objective
Establish a secure, database-backed authentication foundation without breaking existing LAMS 2.0 functionality.

## Phases
### 1. Database Foundation
- Install `mysql2` and `drizzle-orm` (with `drizzle-kit` for migrations).
- Define MySQL schema for `users`, `roles`, `permissions`, and `sessions` (drizzle `schema.ts`).
- Set up `drizzle.config.ts`.
- Create migration script to initialize the database structure.

### 2. Backend Authentication
- Install `bcrypt`, `express-session`, `connect-mysql2` (or alternative MySQL session store).
- Implement password hashing (bcrypt).
- Setup Express sessions with MySQL store.
- Create `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` endpoints.
- Implement session validation middleware.

### 3. Frontend Integration
- Refactor `AppContext.tsx` to call new `/api/auth` endpoints instead of local storage manipulation.
- Implement protected routes/guards on the frontend.
- Secure login UI.

### 4. Authorization
- Implement server-side role/permission validation middleware on all protected API routes.

## Security Constraints
- No plaintext passwords (bcrypt hashing required).
- Sessions backed by database.
- Server-side validation of all requests.
- No direct exposure of MySQL or sensitive secrets.
- `.env` files for configuration, `.env.example` for documentation.
