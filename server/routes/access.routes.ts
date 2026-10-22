import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { user_module_roles, users } from '../../src/db/schema';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();
const HRMS_MODULE = 'hrms';
const ACTIVE_STATUS = 'active';
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
  if (DISPLAY_ROLES[raw]) return DISPLAY_ROLES[raw];
  const normalized = raw.toLowerCase().replace(/[\\s_-]+/g, '');
  const aliases: Record<string, string> = {
    user: 'User', generalstaff: 'User', hrmsstaff: 'User', staff: 'User',
    reportingmanager: 'Reporting Manager', hrmsreporting: 'Reporting Manager',
    hod: 'HoD', reviewingmanager: 'HoD', hrmsreviewing: 'HoD',
    administrator: 'Administrator', admin: 'Administrator', hrmsadmin: 'Administrator',
    auditor: 'Auditor', audit: 'Auditor', hrmsauditor: 'Auditor'
  };
  return aliases[normalized] || null;
}

// Lobby modules are derived exclusively from user_module_roles.
router.get('/modules', isAuthenticated, async (req, res) => {
  try {
    const rows = await db.select({ moduleId: user_module_roles.moduleId, roleId: user_module_roles.roleId })
      .from(user_module_roles).where(and(eq(user_module_roles.biometricId, req.session.biometricId!), eq(user_module_roles.status, ACTIVE_STATUS)));
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

// Return active grants for the selected user. Only an administrator with an active grant can view the matrix.
router.get('/users/:biometricId/roles', isAuthenticated, async (req, res) => {
  try {
    const caller = await db.select({ roleId: user_module_roles.roleId }).from(user_module_roles)
      .where(and(eq(user_module_roles.biometricId, req.session.biometricId!), eq(user_module_roles.status, ACTIVE_STATUS)));
    if (!caller.some((row) => (displayRole(row.roleId) || row.roleId).toLowerCase() === 'administrator')) {
      return res.status(403).json({ message: 'Administrator access required.' });
    }
    const target = String(req.params.biometricId || '').trim();
    if (!/^\\d{4}$/.test(target)) return res.status(400).json({ message: 'Invalid biometric ID.' });
    const assignments = await db.select({ moduleId: user_module_roles.moduleId, roleId: user_module_roles.roleId, status: user_module_roles.status })
      .from(user_module_roles).where(and(eq(user_module_roles.biometricId, target), eq(user_module_roles.status, ACTIVE_STATUS)));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ assignments });
  } catch (error) {
    console.error('User module-role lookup failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to load user module-role assignments.' });
  }
});

// Save the complete module-role matrix. Existing grants are toggled active/inactive; missing grants are inserted active.
router.put('/users/:biometricId/roles', isAuthenticated, async (req, res) => {
  try {
    const caller = await db.select({ roleId: user_module_roles.roleId }).from(user_module_roles)
      .where(and(eq(user_module_roles.biometricId, req.session.biometricId!), eq(user_module_roles.status, ACTIVE_STATUS)));
    if (!caller.some((row) => (displayRole(row.roleId) || row.roleId).toLowerCase() === 'administrator')) {
      return res.status(403).json({ message: 'Administrator access required.' });
    }
    const target = String(req.params.biometricId || '').trim();
    if (!/^\\d{4}$/.test(target)) return res.status(400).json({ message: 'Invalid biometric ID.' });
    const requested = Array.isArray(req.body?.assignments) ? req.body.assignments : null;
    if (!requested) return res.status(400).json({ message: 'Assignments must be an array.' });
    const moduleMap: Record<string, string> = { hrms: 'hrms', lams: 'hrms', pms: 'pms', stock: 'stock', sims: 'stock', finance: 'finance', facility: 'facility', fms: 'facility' };
    const canonical = new Set<string>();
    for (const item of requested) {
      const moduleId = moduleMap[String(item?.moduleId || '').toLowerCase()];
      const roleId = typeof item?.roleId === 'string' ? item.roleId.trim() : '';
      if (!moduleId || !roleId || roleId.length > 100) return res.status(400).json({ message: 'Invalid module-role assignment.' });
      canonical.add(`${moduleId}::${roleId}`);
    }
    const existing = await db.select({ id: user_module_roles.id, moduleId: user_module_roles.moduleId, roleId: user_module_roles.roleId })
      .from(user_module_roles).where(eq(user_module_roles.biometricId, target));
    for (const row of existing) {
      const key = `${moduleMap[row.moduleId.toLowerCase()] || row.moduleId.toLowerCase()}::${row.roleId}`;
      const nextStatus = canonical.has(key) ? 'active' : 'inactive';
      await db.update(user_module_roles).set({ status: nextStatus, lastUpdatedBy: req.session.biometricId!, lastUpdated: new Date() }).where(eq(user_module_roles.id, row.id));
      canonical.delete(key);
    }
    for (const key of canonical) {
      const [moduleId, roleId] = key.split('::');
      await db.insert(user_module_roles).values({ biometricId: target, moduleId, roleId, status: 'active', lastUpdatedBy: req.session.biometricId! });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Saving user module-role assignments failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Unable to save module-role assignments.' });
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
      .where(and(eq(user_module_roles.biometricId, req.session.biometricId!), eq(user_module_roles.moduleId, HRMS_MODULE), eq(user_module_roles.status, ACTIVE_STATUS)));
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
