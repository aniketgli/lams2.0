import { Router, type Request } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { user_module_roles, users } from '../../src/db/schema';
import { asyncHandler, badRequest, forbidden, notFound, saveSession } from '../lib/http';
import { ModuleId, ROLE_LABELS, RoleId, normalizeModule, normalizeRole, pickDefaultRole } from '../lib/roles';
import { PATTERNS, Validator } from '../lib/validate';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { buildSessionPayload } from '../services/session.service';
import { replaceRoleGrants } from '../employees/store';

const router = Router();
router.use(requireAuth);

/**
 * Enter a module from the lobby. The server picks the role:
 *   - keep the current role if the user re-enters the same module and still holds it,
 *   - otherwise the default role for their grants (see pickDefaultRole).
 */
router.post('/module', asyncHandler(async (req, res) => {
  const moduleId = normalizeModule(req.body?.moduleId);
  if (!moduleId) throw badRequest('Unknown module.');

  const auth = req.auth!;
  const roles = auth.grants[moduleId];
  if (!roles) throw forbidden('This module is not assigned to your account.', 'MODULE_NOT_ASSIGNED');

  const keep = auth.activeModule === moduleId && auth.activeRole && roles.includes(auth.activeRole);
  const role = keep ? auth.activeRole : pickDefaultRole(roles);
  if (!role) throw forbidden('No usable role is assigned to you in this module. Contact the administrator.', 'NO_USABLE_ROLE');

  setActive(req, moduleId, role);
  await saveSession(req);
  res.json(await buildSessionPayload(req));
}));

/** Switch role inside the active module. Only roles the user actively holds are accepted. */
router.post('/active-role', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const moduleId = normalizeModule(req.body?.moduleId) ?? auth.activeModule;
  if (!moduleId) throw badRequest('Open a module before switching role.');
  const role = normalizeRole(req.body?.role);
  if (!role) throw badRequest('Unknown role.');
  if (!auth.grants[moduleId]?.includes(role)) {
    throw forbidden('This role is not assigned to your account for this module.', 'ROLE_NOT_ASSIGNED');
  }

  setActive(req, moduleId, role);
  await saveSession(req);
  res.json(await buildSessionPayload(req));
}));

/** Back to the lobby. */
router.post('/exit-module', asyncHandler(async (req, res) => {
  req.session.activeModule = null;
  req.session.activeRole = null;
  req.session.role = undefined;
  req.auth = { ...req.auth!, activeModule: null, activeRole: null };
  await saveSession(req);
  res.json(await buildSessionPayload(req));
}));

function setActive(req: Request, moduleId: ModuleId, role: RoleId) {
  req.session.activeModule = moduleId;
  req.session.activeRole = role;
  req.session.role = role;
  req.auth = { ...req.auth!, activeModule: moduleId, activeRole: role };
}

// ---------------------------------------------------------------------------
// Administrator: module-role matrix for one user.
// ---------------------------------------------------------------------------

const requireHrmsAdmin = requireActiveRole('hrms', 'administrator');
const ROLE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9 _-]{0,99}$/;

function parseTarget(raw: unknown): string {
  const target = String(raw ?? '').trim();
  if (!PATTERNS.biometricId.test(target)) throw badRequest('Invalid biometric ID.');
  return target;
}

router.get('/users/:biometricId/roles', requireHrmsAdmin, asyncHandler(async (req, res) => {
  const target = parseTarget(req.params.biometricId);
  const assignments = await db
    .select({ moduleId: user_module_roles.moduleId, roleId: user_module_roles.roleId, status: user_module_roles.status })
    .from(user_module_roles)
    .where(and(eq(user_module_roles.biometricId, target), eq(user_module_roles.status, 'active')));
  res.json({ assignments });
}));

/**
 * Replace a user's complete module-role matrix in one transaction.
 * Existing grants are switched active/inactive (history is kept); new ones are inserted.
 * The change is written to the audit trail in the same transaction.
 */
router.put('/users/:biometricId/roles', requireHrmsAdmin, asyncHandler(async (req, res) => {
  const target = parseTarget(req.params.biometricId);
  const actor = req.auth!.account.biometricId;

  const v = new Validator(req.body);
  const requested = v.raw('assignments');
  if (!Array.isArray(requested) || requested.length > 100) throw badRequest('Assignments must be a list of at most 100 items.');

  const wanted = new Map<string, { moduleId: ModuleId; roleId: string }>();
  for (const item of requested) {
    const moduleId = normalizeModule(item?.moduleId);
    const roleId = typeof item?.roleId === 'string' ? item.roleId.trim() : '';
    if (!moduleId || !ROLE_ID_PATTERN.test(roleId)) throw badRequest('Invalid module-role assignment.');
    wanted.set(`${moduleId}::${roleId}`, { moduleId, roleId });
  }

  // Do not let an administrator lock themselves out of HRMS administration.
  if (target === actor) {
    const keepsAdmin = [...wanted.values()].some((a) => a.moduleId === 'hrms' && normalizeRole(a.roleId) === 'administrator');
    if (!keepsAdmin) throw badRequest(`You cannot remove your own HRMS ${ROLE_LABELS.administrator} role.`);
  }

  await replaceRoleGrants(req, target, [...wanted.values()]);

  res.json({ success: true });
}));

export default router;
