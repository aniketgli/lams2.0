import { Router, type Request } from 'express';
import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { user_project_histories, users } from '../../src/db/schema';
import { isAdmin, isAuthenticated, requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { EmailService } from '../integrations/email/email.service';
import { HttpError, asyncHandler, badRequest, notFound } from '../lib/http';
import { passwordProblem } from '../lib/passwordPolicy';
import { defaultPasswordHash } from '../masters/accountSettings';
import { normalizeModule } from '../lib/roles';
import { destroyUserSessions } from '../lib/sessionStore';
import { PATTERNS, Validator, escapeHtml, todayInIndia } from '../lib/validate';
import {
  Grant, Viewer, auditPasswordReset, createEmployee, deleteEmployee, getEmployee, listEmployees,
  replaceRoleGrants, setEmployeeStatus, updateEmployee,
} from './store';
import { deleteOwnPhoto, deletePhotoFor, loadPhoto, saveOwnPhoto, savePhotoFor } from './photos';
import { activityCsv, activityTable, employeeDirectoryCsv, employeeDirectoryTable, listActivity, parseActivityFilter } from './activity';
import { getMyProfile, getProfileFor } from './myProfile';

/**
 * Employee accounts and profiles (/api/hrms/employees). Reading is open to
 * signed-in users (with details limited to what they may see); every change
 * is administrator-only and audited.
 */
const router = Router();

const viewerOf = (req: Request): Viewer => ({ id: req.auth!.account.id, role: req.auth!.activeRole });

function accountId(raw: unknown): number {
  const value = String(raw ?? '').trim();
  if (!/^\d{1,20}$/.test(value)) throw badRequest('Invalid employee account ID.');
  return Number(value);
}

// ---------------------------------------------------------------------------
// The signed-in employee's own profile and photo (any role).
// ---------------------------------------------------------------------------
router.get('/me/profile', isAuthenticated, asyncHandler(async (req, res) => {
  res.json(await getMyProfile(viewerOf(req)));
}));

router.put('/me/photo', isAuthenticated, asyncHandler(async (req, res) => {
  const photoUrl = await saveOwnPhoto(req, req.body);
  res.json({ photoUrl, message: 'Profile photo saved.' });
}));

router.delete('/me/photo', isAuthenticated, asyncHandler(async (req, res) => {
  const removed = await deleteOwnPhoto(req);
  res.json({ photoUrl: null, message: removed ? 'Profile photo removed.' : 'There was no photo to remove.' });
}));

/** A photo, for any signed-in user (avatars appear across the portal). */
router.get('/photos/:biometricId', isAuthenticated, asyncHandler(async (req, res) => {
  const biometricId = String(req.params.biometricId || '').trim();
  if (!PATTERNS.biometricId.test(biometricId)) throw badRequest('A valid biometric ID is required.');
  const photo = await loadPhoto(biometricId);
  if (!photo) throw notFound('No photo.');
  const etag = `"${biometricId}-${photo.updatedAt}"`;
  // The address carries a version (?v=), so a cached copy is replaced as soon as the photo changes.
  res.removeHeader('Pragma');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('ETag', etag);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  if (req.get('if-none-match') === etag) return res.status(304).end();
  res.type(photo.mime).send(photo.data);
}));

// ---------------------------------------------------------------------------
// Auditor: directory download and employee activity log (read-only).
// ---------------------------------------------------------------------------
const isAuditor = [requireAuth, requireActiveRole('hrms', 'audit')];
/** Directory downloads: everyone who has a directory (each gets only the people they may see). */
const canExportDirectory = [requireAuth, requireActiveRole('hrms', 'administrator', 'audit', 'reporting_manager', 'reviewing_manager')];

function sendCsv(res: import('express').Response, file: { filename: string; csv: string }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.csv);
}

router.get('/employees/export.csv', ...canExportDirectory, asyncHandler(async (req, res) => {
  sendCsv(res, await employeeDirectoryCsv(req, viewerOf(req)));
}));

/** Rows for a printable PDF (the browser lays it out); logged like the CSV download. */
router.get('/employees/export-pdf', ...canExportDirectory, asyncHandler(async (req, res) => {
  res.json({ generatedAt: new Date().toISOString(), ...(await employeeDirectoryTable(req, viewerOf(req), 'pdf')) });
}));

router.get('/employees/activity/export-pdf', ...isAuditor, asyncHandler(async (req, res) => {
  res.json({ generatedAt: new Date().toISOString(), ...(await activityTable(req, parseActivityFilter(req.query as Record<string, unknown>), 'pdf')) });
}));

router.get('/employees/activity', ...isAuditor, asyncHandler(async (req, res) => {
  res.json(await listActivity(parseActivityFilter(req.query as Record<string, unknown>)));
}));

router.get('/employees/activity.csv', ...isAuditor, asyncHandler(async (req, res) => {
  sendCsv(res, await activityCsv(req, parseActivityFilter(req.query as Record<string, unknown>)));
}));

/** One employee's profile, laid out for their type. Allowed: self, admin, auditor, their manager / HoD. */
router.get('/employees/:userId/profile', isAuthenticated, asyncHandler(async (req, res) => {
  res.json(await getProfileFor(viewerOf(req), accountId(req.params.userId)));
}));

/** Administrator: set or remove any employee's photo (audited with the administrator as the actor). */
async function photoOwner(raw: unknown) {
  const biometricId = String(raw ?? '').trim();
  if (!PATTERNS.biometricId.test(biometricId)) throw badRequest('A valid 4-digit biometric ID is required.');
  const [target] = await db.select({ biometricId: users.biometricId, name: users.name }).from(users).where(eq(users.biometricId, biometricId)).limit(1);
  if (!target) throw notFound('Employee not found.');
  return target;
}

router.put('/employees/:biometricId/photo', isAdmin, asyncHandler(async (req, res) => {
  const photoUrl = await savePhotoFor(req, await photoOwner(req.params.biometricId), req.body);
  res.json({ photoUrl, message: 'Profile photo saved.' });
}));

router.delete('/employees/:biometricId/photo', isAdmin, asyncHandler(async (req, res) => {
  const removed = await deletePhotoFor(req, await photoOwner(req.params.biometricId));
  res.json({ photoUrl: null, message: removed ? 'Profile photo removed.' : 'There was no photo to remove.' });
}));

router.get('/employees', isAuthenticated, asyncHandler(async (req, res) => {
  res.json(await listEmployees(viewerOf(req)));
}));

router.get('/employees/:userId', isAuthenticated, asyncHandler(async (req, res) => {
  res.json(await getEmployee(viewerOf(req), accountId(req.params.userId)));
}));

router.post('/employees', isAdmin, asyncHandler(async (req, res) => {
  const employee = await createEmployee(req, req.body);
  res.status(201).json({
    employee,
    message: `Employee ${employee.name} saved with the HRMS User role and the default password. They must choose their own password at first sign-in.`,
  });
}));

router.put('/employees/:userId', isAdmin, asyncHandler(async (req, res) => {
  const { record, changed } = await updateEmployee(req, accountId(req.params.userId), req.body);
  res.json({ employee: record, changed, message: changed.length ? 'Employee profile updated.' : 'No changes to save.' });
}));

router.patch('/employees/:userId/status', isAdmin, asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  const status = v.oneOf('status', ['active', 'inactive'] as const)!;
  const reason = v.optionalString('reason', { max: 500 }) ?? '';
  const effectiveDate = v.date('effectiveDate', false) ?? todayInIndia();
  v.assert();
  const id = accountId(req.params.userId);
  const employee = await setEmployeeStatus(req, id, { status, reason, effectiveDate });
  // A deactivated user is signed out everywhere at once.
  if (status === 'inactive') await destroyUserSessions(id);
  res.json({ success: true, status, effectiveDate, employee, message: status === 'inactive' ? 'Account deactivated.' : 'Account reactivated.' });
}));

router.delete('/employees/:userId', isAdmin, asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  const reason = v.string('reason', { max: 500 });
  const reference = v.optionalString('reference', { max: 255 });
  v.assert('A deletion reason is required for the audit log.');
  const id = accountId(req.params.userId);
  await deleteEmployee(req, id, reason, reference);
  await destroyUserSessions(id);
  res.json({ success: true, message: 'Employee account permanently deleted and audit log recorded.' });
}));

/** Older role screen: { moduleRoles: { lams: ['hrms_admin', ...], pms: [...] } }. Same rules as /api/access/users/:id/roles. */
const ROLE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9 _-]{0,99}$/;
router.put('/employees/:userId/module-roles', isAdmin, asyncHandler(async (req, res) => {
  const moduleRoles = req.body?.moduleRoles;
  if (!moduleRoles || typeof moduleRoles !== 'object' || Array.isArray(moduleRoles)) throw badRequest('Module roles are missing.');
  const wanted: Grant[] = [];
  for (const [rawModule, roles] of Object.entries(moduleRoles as Record<string, unknown>)) {
    const moduleId = normalizeModule(rawModule);
    if (!moduleId || !Array.isArray(roles) || roles.length > 30) throw badRequest('Module roles contain an unknown module.');
    for (const roleId of roles) {
      if (typeof roleId !== 'string' || !ROLE_ID_PATTERN.test(roleId.trim())) throw badRequest('Module roles contain an invalid role.');
      wanted.push({ moduleId, roleId: roleId.trim() });
    }
  }
  if (wanted.length > 100) throw badRequest('Too many roles.');
  const [target] = await db.select({ biometricId: users.biometricId }).from(users).where(eq(users.id, accountId(req.params.userId))).limit(1);
  if (!target) throw notFound('User account not found.');
  if (target.biometricId === req.auth!.account.biometricId) {
    const keepsAdmin = wanted.some((g) => g.moduleId === 'hrms' && /admin/i.test(g.roleId));
    if (!keepsAdmin) throw badRequest('You cannot remove your own HRMS Administrator role.');
  }
  await replaceRoleGrants(req, target.biometricId, wanted);
  res.json({ success: true, moduleRoles });
}));

// ---------------------------------------------------------------------------
// Password reset (administrator). Only the hash is stored; the user is signed
// out of every device and must set a new password; the reset is audited
// without the password.
// ---------------------------------------------------------------------------
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
/** Random 12-character password that always meets the password rules (has a letter and a digit). */
function generateTemporaryPassword(length = 12): string {
  for (;;) {
    let out = '';
    for (let i = 0; i < length; i++) out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
    if (/\d/.test(out) && /[A-Za-z]/.test(out)) return out;
  }
}

/**
 * Modes:
 *   auto     a random temporary password is emailed to the user
 *   custom   the administrator types a temporary password (same rules as any password)
 *   default  back to the default password for new employees
 * In every mode the user must choose their own password at the next sign-in.
 */
router.post('/employees/:biometricId/reset-password', isAdmin, asyncHandler(async (req, res) => {
  const biometricId = String(req.params.biometricId || '').trim();
  if (!PATTERNS.biometricId.test(biometricId)) throw badRequest('A valid 4-digit biometric ID is required.');
  const mode = req.body?.mode === 'custom' ? 'custom' : req.body?.mode === 'default' ? 'default' : 'auto';
  const reason = String(req.body?.reason || '').trim().slice(0, 500);
  if (req.auth!.account.biometricId === biometricId) throw badRequest('You cannot reset your own password from User Controls.');

  const [target] = await db.select({ id: users.id, name: users.name, email: users.email, biometricId: users.biometricId })
    .from(users).where(eq(users.biometricId, biometricId)).limit(1);
  if (!target) throw notFound('User account not found.');

  let temporaryPassword = '';
  let passwordHash: string;
  if (mode === 'default') {
    const hash = await defaultPasswordHash();
    if (!hash) throw new HttpError(409, 'Set the default password first (Master Settings → Organization).', 'DEFAULT_PASSWORD_MISSING');
    passwordHash = hash;
  } else {
    temporaryPassword = mode === 'auto' ? generateTemporaryPassword() : String(req.body?.password ?? '');
    const problem = passwordProblem(temporaryPassword, target);
    if (problem) throw badRequest(`Temporary password: ${problem}`, { password: problem });
    passwordHash = await bcrypt.hash(temporaryPassword, 12);
  }

  await db.update(users).set({
    passwordHash, mustChangePassword: true,
    lastUpdatedBy: req.auth!.account.biometricId, lastUpdatedAt: new Date(), lastUpdateSummary: 'Password reset by administrator',
  }).where(eq(users.id, target.id));
  await destroyUserSessions(target.id);

  let emailStatus: 'delivered' | 'simulated' | 'not_required' = 'not_required';
  if (mode === 'auto') {
    const reference = reason || 'Official Reset Request';
    const emailResult = await EmailService.sendEmail({
      to: target.email,
      toName: target.name,
      subject: 'Your WII Portal temporary password',
      text: `Dear ${target.name},\n\nAn administrator has reset your WII Portal password. Your temporary password is: ${temporaryPassword}\n\nYou will be asked to choose a new password when you sign in.\n\nReference: ${reference}\n\nIf you did not request this, contact the IT Cell.`,
      html: `<p>Dear ${escapeHtml(target.name)},</p><p>An administrator has reset your WII Portal password.</p><p>Your temporary password is: <strong>${escapeHtml(temporaryPassword)}</strong></p><p>You will be asked to choose a new password when you sign in.</p><p>Reference: ${escapeHtml(reference)}</p><p>If you did not request this, contact the IT Cell.</p>`,
      category: 'SECURITY',
      eventType: 'PASSWORD_RESET',
      referenceId: biometricId,
    });
    emailStatus = emailResult.status === 'delivered' ? 'delivered' : 'simulated';
  }
  await auditPasswordReset(req, target, { mode, emailStatus, reason });

  if (mode === 'auto' && emailStatus !== 'delivered') {
    return res.status(502).json({
      success: false, passwordUpdated: true, emailStatus,
      message: 'Password was updated, but the email could not be delivered. Check the email settings, then reset again.',
      error: 'Password was updated, but the email could not be delivered. Check the email settings, then reset again.',
    });
  }
  const done = mode === 'auto' ? 'Password reset and temporary password emailed.'
    : mode === 'default' ? 'Password reset to the default password.' : 'Temporary password set.';
  return res.json({ success: true, passwordUpdated: true, emailStatus, message: `${done} The user must choose a new password at the next sign-in.` });
}));

/** Project & posting history, keyed by biometric ID. */
router.get('/employees/:biometricId/project-history', isAuthenticated, asyncHandler(async (req, res) => {
  const biometricId = String(req.params.biometricId || '').trim();
  if (!PATTERNS.biometricId.test(biometricId)) throw badRequest('A valid biometric ID is required.');
  const rows = await db.select().from(user_project_histories)
    .where(eq(user_project_histories.biometricId, biometricId))
    .orderBy(user_project_histories.startDate);
  res.json({ records: rows });
}));

export default router;
