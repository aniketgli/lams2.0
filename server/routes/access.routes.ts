import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { user_module_roles, users } from '../../src/db/schema';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();
const DEFAULT_MODULE = 'hrms';
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
  const raw = String(roleId || '').trim();
  const normalized = raw.toLowerCase().replace(/[ -]+/g, '_');
  const aliases: Record<string, string> = {
    hrms_staff: 'User',
    user: 'User',
    general_staff: 'User',
    hrms_reporting: 'Reporting Manager',
    reporting_manager: 'Reporting Manager',
    hrms_reviewing: 'HoD',
    hod: 'HoD',
    reviewing_manager: 'HoD',
    hrms_admin: 'Administrator',
    administrator: 'Administrator',
    hrms_auditor: 'Auditor',
    auditor: 'Auditor',
    audit: 'Auditor'
  };
  return DISPLAY_ROLES[raw] || aliases[normalized] || null;
}

// Lobby modules are derived exclusively from user_module_roles.
router.get('/modules', isAuthenticated, async (req, res) => {
  try {
    const rows = await db.select({ moduleId: user_module_roles.moduleId, roleId: user_module_roles.roleId })
      .from(user_module_roles).where(eq(user_module_roles.biometricId, req.session.biometricId!));
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
  const requestedModule = typeof req.query.moduleId === 'string' ? req.query.moduleId.trim().toLowerCase() : DEFAULT_MODULE;
  const moduleAliases: Record<string, string> = { lams: 'hrms', sims: 'stock', fms: 'facility' };
  const moduleId = moduleAliases[requestedModule] || requestedModule;
  if (!['hrms', 'pms', 'stock', 'facility', 'finance'].includes(moduleId)) {
    return res.status(400).json({ message: 'Unsupported module.' });
  }
  try {
    const rows = await db.select({ roleId: user_module_roles.roleId })
      .from(user_module_roles)
      .where(and(eq(user_module_roles.biometricId, req.session.biometricId!), eq(user_module_roles.moduleId, moduleId)));
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
  const requestedModule = typeof req.body?.moduleId === 'string' ? req.body.moduleId.trim().toLowerCase() : DEFAULT_MODULE;
  const moduleAliases: Record<string, string> = { lams: 'hrms', sims: 'stock', fms: 'facility' };
  const moduleId = moduleAliases[requestedModule] || requestedModule;
  if (!['hrms', 'pms', 'stock', 'facility', 'finance'].includes(moduleId)) return res.status(400).json({ message: 'Unsupported module.' });
  const normalizedRole = displayRole(requested);
  if (!normalizedRole) return res.status(400).json({ message: 'Unsupported role.' });
  try {
    const rows = await db.select({ roleId: user_module_roles.roleId })
      .from(user_module_roles)
      .where(and(eq(user_module_roles.biometricId, req.session.biometricId!), eq(user_module_roles.moduleId, moduleId)));
    const assigned = rows.map((row) => displayRole(row.roleId) || row.roleId).filter(Boolean);
    if (!assigned.includes(normalizedRole) && !rows.some((row) => row.roleId === requested)) return res.status(403).json({ message: 'This role is not assigned to your account for this module.' });
    req.session.activeModule = moduleId;
    req.session.activeRole = normalizedRole;
    await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    return res.json({ activeModule: moduleId, activeRole: normalizedRole });
  } catch (error) {
    console.error('Active role validation failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to change active role.' });
  }
});

export default router;
