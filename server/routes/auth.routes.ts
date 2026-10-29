import { Router } from 'express';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import {
  HttpError, asyncHandler, clearSessionCookie, destroySession, regenerateSession, saveSession, tooManyRequests,
} from '../lib/http';
import { AttemptLimiter } from '../lib/rateLimit';
import { Validator } from '../lib/validate';
import { accountBlockReason, findAccountById, loadActiveGrants } from '../services/access.service';
import { buildSessionPayload } from '../services/session.service';
import { requireAuth } from '../middleware/auth.middleware';
import { authConfig, normalizeLoginEmail } from '../config/auth.config';
import { destroyUserSessions } from '../lib/sessionStore';
import { passwordProblem } from '../lib/passwordPolicy';
import { isDefaultPassword } from '../masters/accountSettings';
import { writeMasterAuditSql } from '../masters/audit';
import { inTransaction } from '../lib/tx';

const router = Router();

// 10 failed attempts per email, and 30 per IP address, every 15 minutes.
const WINDOW_MS = 15 * 60 * 1000;
const perIdentifier = new AttemptLimiter(10, WINDOW_MS);
const perIp = new AttemptLimiter(30, WINDOW_MS);

// Compared against when the user does not exist, so a missing account takes
// as long to reject as a wrong password and response timing reveals nothing.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 12);

const INVALID_CREDENTIALS = 'Invalid email or password.';

/** Public sign-in rules, so the login form can show the same rules the server applies. */
router.get('/config', (_req, res) => {
  res.json({ emailDomains: authConfig.loginEmailDomains });
});

/**
 * Sign in with an institute email (allowed domains only) + password.
 * Only accounts that are active and within their validity date get a session.
 */
router.post('/login', asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  // `email` is the form field; `userId` is accepted from older clients but must still be an email.
  const rawEmail = v.raw('email') ?? v.raw('userId');
  const password = v.string('password', { max: 1024, trim: false });
  const email = normalizeLoginEmail(rawEmail);
  if (!email) {
    const domains = authConfig.loginEmailDomains.map((d) => `@${d}`).join(' or ');
    v.errors.email = typeof rawEmail === 'string' && rawEmail.trim()
      ? `Sign in with your institute email (${domains}).`
      : 'Enter your institute email.';
  }
  v.assert(v.errors.email ?? 'Enter your email and password.');

  const idKey = email!;
  const ipKey = req.ip || 'unknown';
  const wait = Math.max(perIdentifier.retryAfter(idKey), perIp.retryAfter(ipKey));
  if (wait > 0) {
    res.setHeader('Retry-After', String(wait));
    throw tooManyRequests(`Too many failed sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`);
  }

  const [user] = await db.select({
    id: users.id,
    biometricId: users.biometricId,
    passwordHash: users.passwordHash,
    status: users.status,
    validUpto: users.validUpto,
  }).from(users).where(eq(users.email, email!)).limit(1);

  const passwordOk = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !passwordOk) {
    perIdentifier.fail(idKey);
    perIp.fail(ipKey);
    throw new HttpError(401, INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  }

  // Status is only revealed after a correct password, so it cannot be used to probe accounts.
  const blocked = accountBlockReason(user);
  if (blocked) throw new HttpError(403, blocked, 'ACCOUNT_BLOCKED');

  perIdentifier.reset(idKey);

  // New session ID on login prevents session fixation.
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.biometricId = user.biometricId;
  req.session.activeModule = null;
  req.session.activeRole = null;
  req.session.loginAt = Date.now();
  req.session.lastActivityAt = req.session.loginAt;
  await saveSession(req);

  // Build the response through the same checks every later request goes through.
  const account = await findAccountById(user.id);
  if (!account) throw new HttpError(401, INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  const grants = await loadActiveGrants(account.biometricId);
  req.auth = { account, grants, activeModule: null, activeRole: null };

  res.json(await buildSessionPayload(req));
}));

router.post('/logout', asyncHandler(async (req, res) => {
  await destroySession(req);
  clearSessionCookie(res);
  res.json({ success: true });
}));

/** Current identity, active module grants and active role. 401 when signed out. */
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  await saveSession(req); // persists any role cleanup done by requireAuth
  res.json(await buildSessionPayload(req));
}));

// 5 wrong current passwords per account every 15 minutes.
const changeLimiter = new AttemptLimiter(5, WINDOW_MS);

/**
 * The signed-in user sets their own password. Required at first sign-in
 * (default password) and after an administrator reset; also available any time.
 * Every other session of this user is signed out; this one stays.
 */
router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const account = req.auth!.account;
  const body = (req.body ?? {}) as { currentPassword?: unknown; newPassword?: unknown; confirmPassword?: unknown };
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  const key = `user:${account.id}`;
  const wait = changeLimiter.retryAfter(key);
  if (wait > 0) {
    res.setHeader('Retry-After', String(wait));
    throw tooManyRequests(`Too many wrong attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`);
  }

  const errors: Record<string, string> = {};
  if (!currentPassword) errors.currentPassword = 'Enter your current password.';
  const problem = passwordProblem(newPassword, account);
  if (problem) errors.newPassword = problem;
  else if (body.confirmPassword !== undefined && body.confirmPassword !== newPassword) errors.confirmPassword = 'The two passwords do not match.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', errors);

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, account.id)).limit(1);
  if (!row || !(await bcrypt.compare(currentPassword, row.passwordHash))) {
    changeLimiter.fail(key);
    throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', { currentPassword: 'The current password is not correct.' });
  }
  changeLimiter.reset(key);

  if (await bcrypt.compare(newPassword, row.passwordHash)) {
    throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', { newPassword: 'Choose a password different from the current one.' });
  }
  if (await isDefaultPassword(newPassword)) {
    throw new HttpError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', { newPassword: 'The default password cannot be used as your own password.' });
  }

  const wasRequired = account.mustChangePassword;
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await inTransaction(async (conn) => {
    await conn.query(
      `UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = NOW(),
              last_updated_by = ?, last_updated_at = NOW(), last_update_summary = ? WHERE id = ?`,
      [passwordHash, account.biometricId, 'Password changed by the user', account.id],
    );
    await writeMasterAuditSql(conn, req, {
      masterKey: 'employee_password', recordId: account.biometricId, recordLabel: account.name, action: 'UPDATE',
      before: { changedBy: null }, after: { changedBy: 'self', firstSignIn: wasRequired },
    });
  });

  await destroyUserSessions(account.id, req.sessionID);
  req.auth = { ...req.auth!, account: { ...account, mustChangePassword: false } };
  req.session.lastActivityAt = Date.now();
  await saveSession(req);
  res.json({ ...(await buildSessionPayload(req)), message: 'Your password has been changed.' });
}));

export const authRoutes = router;
