import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../../src/db';
import { users, user_module_roles } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password || email.length > 255 || password.length > 1024) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Select only columns that exist in the reviewed users table; role assignments
    // are stored separately in user_module_roles.
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      biometricId: users.biometricId
    }).from(users).where(eq(users.email, email));

    // Use one generic response for unknown users and wrong passwords.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const assignments = await db.select({
      moduleId: user_module_roles.moduleId,
      roleId: user_module_roles.roleId
    }).from(user_module_roles).where(eq(user_module_roles.biometricId, user.biometricId));

    const modules: Record<string, string[]> = {};
    for (const assignment of assignments) {
      const moduleId = assignment.moduleId.toLowerCase() === 'lams' ? 'hrms' : assignment.moduleId.toLowerCase();
      modules[moduleId] ||= [];
      if (!modules[moduleId].includes(assignment.roleId)) modules[moduleId].push(assignment.roleId);
    }

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
        return res.json({ user: { id: String(user.id), biometricId: user.biometricId, name: user.name, email: user.email }, modules });
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
      path: '/'
    });
    return res.status(200).json({ message: 'Logged out' });
  });
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const [user] = await db.select({ id: users.id, biometricId: users.biometricId, name: users.name, email: users.email })
      .from(users).where(eq(users.id, Number(req.session.userId)));
    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ message: 'Session user no longer exists.' });
    }
    const assignments = await db.select({ moduleId: user_module_roles.moduleId, roleId: user_module_roles.roleId })
      .from(user_module_roles).where(eq(user_module_roles.biometricId, user.biometricId));
    const modules: Record<string, string[]> = {};
    for (const assignment of assignments) {
      const moduleId = assignment.moduleId.toLowerCase() === 'lams' ? 'hrms' : assignment.moduleId.toLowerCase();
      modules[moduleId] ||= [];
      if (!modules[moduleId].includes(assignment.roleId)) modules[moduleId].push(assignment.roleId);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ userId: String(user.id), user: { ...user, id: String(user.id) }, modules, activeModule: req.session.activeModule || null, activeRole: req.session.activeRole || null });
  } catch (error) {
    console.error('Session identity lookup failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to load the signed-in user.' });
  }
});

export const authRoutes = router;
