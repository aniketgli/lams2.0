import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../../src/db';
import { users, user_module_roles } from '../../src/db/schema';
import { eq, or } from 'drizzle-orm';

const router = express.Router();

/** MySQL DATE values are mapped to YYYY-MM-DD strings by the Drizzle schema. */
function isValidityCurrent(validUpto: string | null | undefined): boolean {
  if (!validUpto) return false;
  // Compare date-only strings so the server's timezone/time-of-day cannot
  // accidentally expire an account early or extend it beyond the saved date.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return validUpto >= today;
}

function accountBlocked(status: string, validUpto: string | null | undefined): string | null {
  if (status !== 'active') {
    return status === 'expired'
      ? 'Account validity has expired. Please contact administrator.'
      : 'Account is inactive. Please contact administrator.';
  }
  if (!isValidityCurrent(validUpto)) {
    return 'Account validity has expired or is not configured. Please contact administrator.';
  }
  return null;
}

async function loadModules(biometricId: string): Promise<Record<string, string[]>> {
  const assignments = await db.select({
    moduleId: user_module_roles.moduleId,
    roleId: user_module_roles.roleId,
  }).from(user_module_roles).where(eq(user_module_roles.biometricId, biometricId));

  const modules: Record<string, string[]> = {};
  for (const assignment of assignments) {
    const moduleId = assignment.moduleId.toLowerCase() === 'lams'
      ? 'hrms'
      : assignment.moduleId.toLowerCase();
    modules[moduleId] ||= [];
    if (!modules[moduleId].includes(assignment.roleId)) {
      modules[moduleId].push(assignment.roleId);
    }
  }
  return modules;
}

router.post('/login', async (req, res) => {
  // Keep compatibility with the current email-based form while also accepting
  // the institute's biometric ID as the user ID.
  const identifierRaw = req.body?.userId ?? req.body?.biometricId ?? req.body?.email;
  const identifier = typeof identifierRaw === 'string' ? identifierRaw.trim() : '';
  const emailIdentifier = identifier.toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!identifier || !password || identifier.length > 255 || password.length > 1024) {
    return res.status(400).json({ message: 'User ID and password are required.' });
  }

  try {
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      biometricId: users.biometricId,
      status: users.status,
      validUpto: users.validUpto,
    }).from(users).where(or(
      eq(users.email, emailIdentifier),
      eq(users.biometricId, identifier),
    )).limit(1);

    // Do not disclose whether a particular user ID/email exists.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid user ID or password.' });
    }

    const blockedReason = accountBlocked(user.status, user.validUpto);
    if (blockedReason) {
      return res.status(403).json({ message: blockedReason });
    }

    const modules = await loadModules(user.biometricId);

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        console.error('Session regeneration failed:', regenerateError);
        return res.status(500).json({ message: 'Unable to start a secure session.' });
      }
      req.session.userId = String(user.id);
      req.session.biometricId = user.biometricId;
      req.session.activeModule = null;
      req.session.activeRole = null;
      req.session.save((saveError) => {
        if (saveError) {
          console.error('Session save failed:', saveError);
          return res.status(500).json({ message: 'Unable to start a secure session.' });
        }
        res.setHeader('Cache-Control', 'no-store');
        return res.json({
          user: {
            id: String(user.id),
            biometricId: user.biometricId,
            name: user.name,
            email: user.email,
          },
          modules,
        });
      });
    });
  } catch (error) {
    console.error('Login error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to sign in right now.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout session destruction failed:', error);
      return res.status(500).json({ message: 'Unable to complete logout.' });
    }
    res.clearCookie('connect.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return res.status(200).json({ message: 'Logged out' });
  });
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const [user] = await db.select({
      id: users.id,
      biometricId: users.biometricId,
      name: users.name,
      email: users.email,
      status: users.status,
      validUpto: users.validUpto,
    }).from(users).where(eq(users.id, Number(req.session.userId))).limit(1);

    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ message: 'Session user no longer exists.' });
    }

    // Re-check every session identity request so a deactivated or expired
    // account cannot continue using an existing login session.
    const blockedReason = accountBlocked(user.status, user.validUpto);
    if (blockedReason) {
      req.session.destroy(() => undefined);
      res.clearCookie('connect.sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      return res.status(403).json({ message: blockedReason });
    }

    const modules = await loadModules(user.biometricId);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      userId: String(user.id),
      user: { id: String(user.id), biometricId: user.biometricId, name: user.name, email: user.email },
      modules,
      activeModule: req.session.activeModule || null,
      activeRole: req.session.activeRole || null,
    });
  } catch (error) {
    console.error('Session identity lookup failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to load the signed-in user.' });
  }
});

export const authRoutes = router;
