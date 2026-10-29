import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { asyncHandler, clearSessionCookie, destroySession, forbidden, unauthorized, HttpError } from '../lib/http';
import type { ModuleId, RoleId } from '../lib/roles';
import { PASSIVE_REQUEST_HEADER, sessionConfig } from '../config/session.config';
import { accountBlockReason, findAccountById, hasGrant, loadActiveGrants } from '../services/access.service';

/**
 * Every authenticated request re-checks:
 *   1. the session is within its idle limit and its maximum lifetime,
 *   2. the account still exists, is active and within its validity date,
 *   3. the session's active module/role is still an ACTIVE grant,
 *   4. no password change is pending (new account or administrator reset).
 * A deactivated account, expired session or revoked role therefore takes
 * effect on the very next request, on every device.
 */
/** The only API paths usable while a password change is pending. */
const PASSWORD_CHANGE_ALLOWED = new Set(['/api/auth/me', '/api/auth/change-password', '/api/auth/logout']);
const requestPath = (req: Request) => (req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '');

export const requireAuth: RequestHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (req.auth) return next(); // already checked earlier in this request

  const userId = Number(req.session?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw unauthorized();

  const endSession = async (status: number, message: string, code: string): Promise<never> => {
    await destroySession(req);
    clearSessionCookie(res);
    throw new HttpError(status, message, code);
  };

  // --- Time limits --------------------------------------------------------
  const now = Date.now();
  const loginAt = Number(req.session.loginAt);
  const lastActivityAt = Number(req.session.lastActivityAt);
  if (!Number.isFinite(loginAt) || !Number.isFinite(lastActivityAt) || loginAt <= 0 || lastActivityAt <= 0) {
    // Sessions created before these limits existed are not trusted.
    await endSession(401, 'Your session has ended. Please sign in again.', 'SESSION_EXPIRED');
  }
  if (now - lastActivityAt > sessionConfig.idleMs) {
    const minutes = Math.round(sessionConfig.idleMs / 60000);
    await endSession(401, `You were signed out after ${minutes} minutes of inactivity.`, 'SESSION_IDLE');
  }
  if (now - loginAt > sessionConfig.maxMs) {
    await endSession(401, 'Your session has reached its time limit. Please sign in again.', 'SESSION_EXPIRED');
  }

  // --- Account ------------------------------------------------------------
  const account = await findAccountById(userId);
  if (!account) await endSession(401, 'Your session has ended. Please sign in again.', 'SESSION_ENDED');

  const blocked = accountBlockReason(account!);
  if (blocked) await endSession(403, blocked, 'ACCOUNT_BLOCKED');

  // --- Password -------------------------------------------------------------
  // A new account (default password) or one reset by an administrator can only
  // see who it is and set a new password; everything else waits until then.
  if (account!.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(requestPath(req))) {
    throw new HttpError(403, 'Set a new password before continuing.', 'PASSWORD_CHANGE_REQUIRED');
  }

  // --- Active module / role -------------------------------------------------
  const grants = await loadActiveGrants(account!.biometricId);
  let activeModule = req.session.activeModule ?? null;
  let activeRole = req.session.activeRole ?? null;
  if (activeModule && (!activeRole || !hasGrant(grants, activeModule, activeRole))) {
    // The role was revoked (or the module removed) since it was selected.
    activeModule = null;
    activeRole = null;
  }

  // Only touch the session when something changed, so ordinary requests do
  // not cause a session-store write.
  if (req.session.biometricId !== account!.biometricId) req.session.biometricId = account!.biometricId;
  if ((req.session.activeModule ?? null) !== activeModule) req.session.activeModule = activeModule;
  if ((req.session.activeRole ?? null) !== activeRole) req.session.activeRole = activeRole;
  if ((req.session.role ?? null) !== activeRole) req.session.role = activeRole ?? undefined;

  // Background status checks (marked passive) must not keep an idle user signed in.
  const passive = req.get(PASSIVE_REQUEST_HEADER) === '1';
  if (!passive && now - lastActivityAt > sessionConfig.activityWriteIntervalMs) {
    req.session.lastActivityAt = now;
  }

  req.auth = { account: account!, grants, activeModule, activeRole };
  next();
});

/**
 * Rejects a request made by a browser tab that still shows an old role.
 * The client sends `x-wii-context: <module>:<role>` (or "none") with every
 * request; if another tab or device has since changed the role in this
 * session, the action is refused instead of running under a role the user
 * cannot see. The tab then reloads its session and shows the current role.
 */
export const CONTEXT_HEADER = 'x-wii-context';
export const requireCurrentContext: RequestHandler = (req, _res, next) => {
  const claimed = req.get(CONTEXT_HEADER);
  if (!claimed || !req.session?.userId) return next(); // no claim, or public route
  const actual = req.session.activeModule && req.session.activeRole
    ? `${req.session.activeModule}:${req.session.activeRole}`
    : 'none';
  if (claimed !== actual) {
    return next(new HttpError(409, 'Your role was changed in another tab or window. The page has been updated; please try again.', 'CONTEXT_CHANGED'));
  }
  next();
};

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
