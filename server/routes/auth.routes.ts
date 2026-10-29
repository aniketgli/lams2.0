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

export const authRoutes = router;
