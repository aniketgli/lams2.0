import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { asyncHandler, clearSessionCookie, destroySession, forbidden, unauthorized, HttpError } from '../lib/http';
import type { ModuleId, RoleId } from '../lib/roles';
import { accountBlockReason, findAccountById, hasGrant, loadActiveGrants } from '../services/access.service';

/**
 * Every authenticated request re-checks, against the database:
 *   1. the account still exists,
 *   2. it is active and within its validity date,
 *   3. the session's active module/role is still an ACTIVE grant.
 * A deactivated account or revoked role therefore takes effect on the very next request.
 */
export const requireAuth: RequestHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (req.auth) return next(); // already checked earlier in this request

  const userId = Number(req.session?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw unauthorized();

  const account = await findAccountById(userId);
  if (!account) {
    await destroySession(req);
    clearSessionCookie(res);
    throw unauthorized('Your session has ended. Please sign in again.');
  }

  const blocked = accountBlockReason(account);
  if (blocked) {
    await destroySession(req);
    clearSessionCookie(res);
    throw new HttpError(403, blocked, 'ACCOUNT_BLOCKED');
  }

  const grants = await loadActiveGrants(account.biometricId);

  let activeModule = req.session.activeModule ?? null;
  let activeRole = req.session.activeRole ?? null;
  if (activeModule && (!activeRole || !hasGrant(grants, activeModule, activeRole))) {
    // The role was revoked (or the module removed) since it was selected.
    activeModule = null;
    activeRole = null;
  }
  req.session.biometricId = account.biometricId;
  req.session.activeModule = activeModule;
  req.session.activeRole = activeRole;
  req.session.role = activeRole ?? undefined;

  req.auth = { account, grants, activeModule, activeRole };
  next();
});

/**
 * Allows the request only when the user is currently acting in `moduleId`
 * with one of `roles`. Holding a role is not enough; it must be the active one,
 * so an administrator browsing as "User" cannot call admin endpoints.
 */
export function requireActiveRole(moduleId: ModuleId, ...roles: RoleId[]): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) return next(unauthorized());
    if (auth.activeModule !== moduleId || !auth.activeRole) {
      return next(forbidden('Open this module and choose a role first.', 'NO_ACTIVE_ROLE'));
    }
    if (!roles.includes(auth.activeRole)) {
      return next(forbidden('Your current role does not allow this action.', 'ROLE_NOT_ALLOWED'));
    }
    next();
  };
}

/** Requires an active session in the given module, with any role. */
export function requireModule(moduleId: ModuleId): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (req.auth.activeModule !== moduleId) return next(forbidden('Open this module first.', 'NO_ACTIVE_ROLE'));
    next();
  };
}

// ---------------------------------------------------------------------------
// Backwards-compatible names used by the existing HRMS and integration routes.
// Express accepts arrays of handlers anywhere a handler is expected.
// ---------------------------------------------------------------------------
export const isAuthenticated: RequestHandler = requireAuth;
export const isAdmin: RequestHandler[] = [requireAuth, requireActiveRole('hrms', 'administrator')];
