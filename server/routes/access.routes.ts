import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { user_module_roles, users } from '../../src/db/schema';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();
const HRMS_MODULE = 'hrms';
const DISPLAY_ROLES: Record<string, string> = {
  hrms_staff: 'User',
  hrms_reporting: 'Reporting Manager',
  hrms_reviewing: 'HoD',
  hrms_admin: 'Administrator',
  hrms_auditor: 'Auditor',
  User: 'User',
  'Reporting Manager': 'Reporting Manager',
  HoD: 'HoD',
  Administrator: 'Administrator',
  Auditor: 'Auditor'
};
const APPROVED_ROLES = new Set(['User', 'Reporting Manager', 'HoD', 'Administrator', 'Auditor']);

function displayRole(roleId: string): string | null {
  return DISPLAY_ROLES[roleId] || null;
}

// Lobby modules are derived exclusively from user_module_roles.
router.get('/modules', isAuthenticated, async (req, res) => {
  try {
    const rows = await db.select({ moduleId: user_module_roles.moduleId, roleId: user_module_roles.roleId })
      .from(user_module_roles).where(eq(user_module_roles.userId, req.session.userId!));
    const byModule: Record<string, string[]> = {};
    for (const row of rows) {
      const moduleId = row.moduleId.toLowerCase() === 'lams' ? 'hrms' : row.moduleId.toLowerCase();
      byModule[moduleId] ||= [];
      if (!byModule[moduleId].includes(row.roleId)) byModule[moduleId].push(row.roleId);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ modules: Object.entries(byModule).map(([moduleId, roles]) => ({ moduleId, roles })) });
  } catch (error) {
    console.error('Module assignment lookup failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to load assigned modules.' });
  }
});

// HRMS role choices must come from the signed-in user's existing assignments.
router.get('/roles', isAuthenticated, async (req, res) => {
  try {
    const rows = await db.select({ roleId: user_module_roles.roleId })
      .from(user_module_roles)
      .where(and(eq(user_module_roles.userId, req.session.userId!), eq(user_module_roles.moduleId, HRMS_MODULE)));
    const roles = [...new Set(rows.map((row) => displayRole(row.roleId)).filter((role): role is string => Boolean(role) && APPROVED_ROLES.has(role)))];
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ roles });
  } catch (error) {
    console.error('Role assignment lookup failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to load assigned roles.' });
  }
});

// Role switching changes only the active session context; it never edits user_module_roles.
router.post('/active-role', isAuthenticated, async (req, res) => {
  const requested = typeof req.body?.role === 'string' ? req.body.role.trim() : '';
  if (!APPROVED_ROLES.has(requested)) return res.status(400).json({ message: 'Unsupported HRMS role.' });
  try {
    const rows = await db.select({ roleId: user_module_roles.roleId })
      .from(user_module_roles)
      .where(and(eq(user_module_roles.userId, req.session.userId!), eq(user_module_roles.moduleId, HRMS_MODULE)));
    const assigned = rows.map((row) => displayRole(row.roleId)).filter((role): role is string => Boolean(role));
    if (!assigned.includes(requested)) return res.status(403).json({ message: 'This role is not assigned to your account.' });
    req.session.activeModule = HRMS_MODULE;
    req.session.activeRole = requested;
    await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    return res.json({ activeModule: HRMS_MODULE, activeRole: requested });
  } catch (error) {
    console.error('Active role validation failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to change active role.' });
  }
});

export default router;
