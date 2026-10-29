import { Router } from 'express';
import { and, eq, ne, sql } from 'drizzle-orm';
import { isIP } from 'node:net';
import { db } from '../../src/db';
import { biometric_machines, employee_profiles, master_audit_logs, organization_settings, shifts } from '../../src/db/schema';
import { HttpError, asyncHandler, badRequest, notFound } from '../lib/http';
import { PATTERNS, Validator } from '../lib/validate';
import { requireActiveRole, requireAuth } from '../middleware/auth.middleware';
import { writeMasterAudit } from './audit';

/**
 * Shift Master, Biometric Machines and Organization settings (mounted at /api/hrms).
 * Every change is written together with its audit entry in one transaction.
 */
const router = Router();

const canView = [requireAuth, requireActiveRole('hrms', 'administrator', 'audit')];
const canEdit = [requireAuth, requireActiveRole('hrms', 'administrator')];

function idParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw badRequest('Invalid record ID.');
  return id;
}

const reasonOf = (body: unknown) => {
  const r = (body as { reason?: unknown })?.reason;
  return typeof r === 'string' && r.trim() ? r.trim().slice(0, 500) : null;
};

// ===========================================================================
// Shift Master
// ===========================================================================

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function toShift(row: typeof shifts.$inferSelect) {
  return {
    id: String(row.id),
    code: row.code,
    name: row.name,
    startTime: String(row.startTime).slice(0, 5),
    endTime: String(row.endTime).slice(0, 5),
    gracePeriodMins: Number(row.gracePeriodMins ?? 0),
    halfDayHours: Number(row.halfDayHours ?? 4),
    fullDayHours: Number(row.fullDayHours ?? 8),
    halfDayCutoffTime: row.halfDayCutoffTime ? String(row.halfDayCutoffTime).slice(0, 5) : null,
    description: row.description ?? '',
    applicableDays: Array.isArray(row.applicableDays) ? row.applicableDays : [],
    isDefault: Boolean(row.isDefault),
    status: String(row.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
    isActive: String(row.status || 'active').toLowerCase() !== 'inactive',
  };
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function validateShift(body: unknown) {
  const v = new Validator(body);
  const code = v.string('code', { max: 50, pattern: /^[A-Za-z0-9][A-Za-z0-9_-]*$/, patternMessage: 'Use letters, numbers, _ or - only.' }).toUpperCase();
  const name = v.string('name', { max: 255 });
  const startTime = v.string('startTime', { pattern: PATTERNS.time24, patternMessage: 'Use HH:MM (24-hour).' });
  const endTime = v.string('endTime', { pattern: PATTERNS.time24, patternMessage: 'Use HH:MM (24-hour).' });
  const halfDayCutoffTime = v.optionalString('halfDayCutoffTime', { pattern: PATTERNS.time24, patternMessage: 'Use HH:MM (24-hour).' });
  const gracePeriodMins = v.int('gracePeriodMins', { min: 0, max: 240 }) ?? 0;
  const halfDayHours = Number(v.raw('halfDayHours'));
  const fullDayHours = Number(v.raw('fullDayHours'));
  if (!Number.isFinite(halfDayHours) || halfDayHours <= 0 || halfDayHours > 24) v.errors.halfDayHours = 'Enter hours between 0.5 and 24.';
  if (!Number.isFinite(fullDayHours) || fullDayHours <= 0 || fullDayHours > 24) v.errors.fullDayHours = 'Enter hours between 0.5 and 24.';
  if (!v.errors.halfDayHours && !v.errors.fullDayHours && halfDayHours >= fullDayHours) {
    v.errors.halfDayHours = 'Half-day hours must be less than full-day hours.';
  }
  if (startTime && endTime && !v.errors.startTime && !v.errors.endTime && startTime === endTime) {
    v.errors.endTime = 'End time must differ from start time.';
  }
  if (halfDayCutoffTime && startTime && endTime && !v.errors.startTime && !v.errors.endTime && minutes(startTime) < minutes(endTime)) {
    const cutoff = minutes(halfDayCutoffTime);
    if (cutoff <= minutes(startTime) || cutoff >= minutes(endTime)) v.errors.halfDayCutoffTime = 'Cut-off must fall between start and end time.';
  }
  const daysRaw = v.raw('applicableDays');
  const applicableDays = Array.isArray(daysRaw) ? WEEK_DAYS.filter((d) => daysRaw.includes(d)) : [];
  if (applicableDays.length === 0) v.errors.applicableDays = 'Select at least one working day.';
  const description = v.optionalString('description', { max: 2000 }) ?? '';
  const isDefault = v.bool('isDefault');
  const status = v.oneOf('status', ['active', 'inactive'] as const) ?? 'active';
  if (isDefault && status === 'inactive') v.errors.status = 'The default shift must be active.';
  v.assert();
  return {
    code, name, startTime, endTime, gracePeriodMins, halfDayCutoffTime, description, applicableDays, isDefault, status,
    halfDayHours: halfDayHours.toFixed(1), fullDayHours: fullDayHours.toFixed(1),
  };
}

async function shiftAssignments(id: number): Promise<number> {
  const [row] = await db.select({ n: sql<number>`COUNT(*)` }).from(employee_profiles).where(eq(employee_profiles.shiftId, String(id)));
  return Number(row?.n ?? 0);
}

router.get('/shifts', requireAuth, asyncHandler(async (_req, res) => {
  const rows = await db.select().from(shifts).orderBy(shifts.name);
  res.json(rows.map(toShift));
}));

router.get('/shifts/:id/audit', ...canView, asyncHandler(async (req, res) => {
  const rows = await db.select().from(master_audit_logs)
    .where(and(eq(master_audit_logs.masterKey, 'shift'), eq(master_audit_logs.recordId, String(idParam(req.params.id)))))
    .orderBy(sql`${master_audit_logs.createdAt} DESC`);
  res.json(rows);
}));

router.post('/shifts', ...canEdit, asyncHandler(async (req, res) => {
  const input = validateShift(req.body);
  const [dup] = await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.code, input.code));
  if (dup) throw badRequest('Please correct the highlighted fields.', { code: 'A shift with this code already exists.' });

  const saved = await db.transaction(async (tx) => {
    if (input.isDefault) await tx.update(shifts).set({ isDefault: false });
    const [result] = await tx.insert(shifts).values(input);
    const [row] = await tx.select().from(shifts).where(eq(shifts.id, Number(result.insertId)));
    const shift = toShift(row);
    await writeMasterAudit(tx, req, { masterKey: 'shift', recordId: shift.id, recordLabel: `${shift.name} (${shift.code})`, action: 'CREATE', after: shift, reason: reasonOf(req.body) });
    return shift;
  });
  res.status(201).json({ ...saved, message: 'Shift created.' });
}));

router.put('/shifts/:id', ...canEdit, asyncHandler(async (req, res) => {
  const id = idParam(req.params.id);
  const input = validateShift(req.body);
  const [existingRow] = await db.select().from(shifts).where(eq(shifts.id, id));
  if (!existingRow) throw notFound('Shift not found.');
  const before = toShift(existingRow);

  const [dup] = await db.select({ id: shifts.id }).from(shifts).where(and(eq(shifts.code, input.code), ne(shifts.id, id)));
  if (dup) throw badRequest('Please correct the highlighted fields.', { code: 'A shift with this code already exists.' });
  if (before.isDefault && !input.isDefault) {
    throw new HttpError(409, 'There must always be a default shift. Make another shift the default instead.', 'DEFAULT_REQUIRED');
  }
  if (before.status === 'active' && input.status === 'inactive') {
    const assigned = await shiftAssignments(id);
    if (assigned) throw new HttpError(409, `This shift is assigned to ${assigned} employee(s). Reassign them before deactivating it.`, 'IN_USE');
  }

  const saved = await db.transaction(async (tx) => {
    if (input.isDefault && !before.isDefault) await tx.update(shifts).set({ isDefault: false });
    await tx.update(shifts).set(input).where(eq(shifts.id, id));
    const [row] = await tx.select().from(shifts).where(eq(shifts.id, id));
    const shift = toShift(row);
    await writeMasterAudit(tx, req, {
      masterKey: 'shift', recordId: shift.id, recordLabel: `${shift.name} (${shift.code})`,
      action: before.status !== shift.status ? 'STATUS' : 'UPDATE', before, after: shift, reason: reasonOf(req.body),
    });
    return shift;
  });
  res.json({ ...saved, message: 'Shift updated.' });
}));

router.delete('/shifts/:id', ...canEdit, asyncHandler(async (req, res) => {
  const id = idParam(req.params.id);
  const [row] = await db.select().from(shifts).where(eq(shifts.id, id));
  if (!row) throw notFound('Shift not found.');
  const shift = toShift(row);
  if (shift.isDefault) throw new HttpError(409, 'The default shift cannot be deleted. Make another shift the default first.', 'DEFAULT_REQUIRED');
  const assigned = await shiftAssignments(id);
  if (assigned) throw new HttpError(409, `This shift is assigned to ${assigned} employee(s) and cannot be deleted. Make it Inactive instead.`, 'IN_USE');

  await db.transaction(async (tx) => {
    await writeMasterAudit(tx, req, { masterKey: 'shift', recordId: shift.id, recordLabel: `${shift.name} (${shift.code})`, action: 'DELETE', before: shift, reason: reasonOf(req.body) });
    await tx.delete(shifts).where(eq(shifts.id, id));
  });
  res.json({ success: true, message: 'Shift deleted.' });
}));

// ===========================================================================
// Biometric Machines
// ===========================================================================

const PURPOSES = ['ATTENDANCE', 'ACCESS', 'BOTH'] as const;

function toMachine(row: typeof biometric_machines.$inferSelect) {
  return {
    id: row.id,
    fullName: row.fullName,
    shortName: row.shortName,
    serialNumber: row.serialNumber,
    ipAddress: row.ipAddress,
    status: String(row.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    purpose: (PURPOSES as readonly string[]).includes(String(row.purpose)) ? row.purpose : 'ATTENDANCE',
    /** Punches from this machine count for attendance unless it is access-only. */
    countsForAttendance: row.purpose !== 'ACCESS',
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function validateMachine(body: unknown, idFromPath?: string) {
  const v = new Validator(body);
  const id = idFromPath ?? v.string('id', { max: 64, pattern: /^[A-Za-z0-9][A-Za-z0-9_-]*$/, patternMessage: 'Use letters, numbers, _ or - only.' });
  const fullName = v.string('fullName', { max: 255 });
  const shortName = v.string('shortName', { max: 80 }).toUpperCase();
  const serialNumber = v.string('serialNumber', { max: 120 }).toUpperCase();
  const ipAddress = v.string('ipAddress', { max: 45 });
  if (ipAddress && !v.errors.ipAddress && isIP(ipAddress) === 0) v.errors.ipAddress = 'Enter a valid IPv4 or IPv6 address.';
  const purpose = v.oneOf('purpose', PURPOSES) ?? 'ATTENDANCE';
  const status = v.oneOf('status', ['ACTIVE', 'INACTIVE'] as const) ?? 'ACTIVE';
  v.assert();
  return { id, fullName, shortName, serialNumber, ipAddress, purpose, status };
}

async function machineConflicts(input: { id: string; shortName: string; serialNumber: string; ipAddress: string }, rowIdToIgnore?: number) {
  const rows = await db.select().from(biometric_machines);
  const errors: Record<string, string> = {};
  for (const m of rows) {
    if (rowIdToIgnore && m.rowId === rowIdToIgnore) continue;
    if (m.id.toLowerCase() === input.id.toLowerCase()) errors.id = 'Another machine already uses this Device ID.';
    if (m.shortName === input.shortName) errors.shortName = 'Another machine already uses this short name.';
    if (m.serialNumber === input.serialNumber) errors.serialNumber = 'Another machine already has this serial number.';
    if (m.ipAddress === input.ipAddress) errors.ipAddress = 'Another machine already uses this IP address.';
  }
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
}

router.get('/biometric-machines', ...canView, asyncHandler(async (_req, res) => {
  const rows = await db.select().from(biometric_machines).orderBy(biometric_machines.id);
  res.json(rows.map(toMachine));
}));

router.post('/biometric-machines', ...canEdit, asyncHandler(async (req, res) => {
  const input = validateMachine(req.body);
  await machineConflicts(input);
  const saved = await db.transaction(async (tx) => {
    await tx.insert(biometric_machines).values(input);
    const [row] = await tx.select().from(biometric_machines).where(eq(biometric_machines.id, input.id));
    const machine = toMachine(row);
    await writeMasterAudit(tx, req, { masterKey: 'biometric_machine', recordId: machine.id, recordLabel: `${machine.fullName} (${machine.id})`, action: 'CREATE', after: machine, reason: reasonOf(req.body) });
    return machine;
  });
  res.status(201).json(saved);
}));

router.put('/biometric-machines/:id', ...canEdit, asyncHandler(async (req, res) => {
  const [existingRow] = await db.select().from(biometric_machines).where(eq(biometric_machines.id, req.params.id));
  if (!existingRow) throw notFound('Biometric machine not found.');
  const input = validateMachine(req.body, existingRow.id);
  await machineConflicts(input, existingRow.rowId);
  const before = toMachine(existingRow);
  const saved = await db.transaction(async (tx) => {
    await tx.update(biometric_machines).set({
      fullName: input.fullName, shortName: input.shortName, serialNumber: input.serialNumber,
      ipAddress: input.ipAddress, purpose: input.purpose, status: input.status,
    }).where(eq(biometric_machines.rowId, existingRow.rowId));
    const [row] = await tx.select().from(biometric_machines).where(eq(biometric_machines.rowId, existingRow.rowId));
    const machine = toMachine(row);
    await writeMasterAudit(tx, req, {
      masterKey: 'biometric_machine', recordId: machine.id, recordLabel: `${machine.fullName} (${machine.id})`,
      action: before.status !== machine.status && before.fullName === machine.fullName ? 'STATUS' : 'UPDATE',
      before, after: machine, reason: reasonOf(req.body),
    });
    return machine;
  });
  res.json(saved);
}));

router.patch('/biometric-machines/:id/status', ...canEdit, asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  const status = v.oneOf('status', ['ACTIVE', 'INACTIVE'] as const);
  v.assert();
  const [existingRow] = await db.select().from(biometric_machines).where(eq(biometric_machines.id, req.params.id));
  if (!existingRow) throw notFound('Biometric machine not found.');
  const before = toMachine(existingRow);
  if (before.status === status) return res.json(before);
  const saved = await db.transaction(async (tx) => {
    await tx.update(biometric_machines).set({ status: status! }).where(eq(biometric_machines.rowId, existingRow.rowId));
    const [row] = await tx.select().from(biometric_machines).where(eq(biometric_machines.rowId, existingRow.rowId));
    const machine = toMachine(row);
    await writeMasterAudit(tx, req, { masterKey: 'biometric_machine', recordId: machine.id, recordLabel: `${machine.fullName} (${machine.id})`, action: 'STATUS', before, after: machine, reason: reasonOf(req.body) });
    return machine;
  });
  res.json(saved);
}));

router.delete('/biometric-machines/:id', ...canEdit, asyncHandler(async (req, res) => {
  const [existingRow] = await db.select().from(biometric_machines).where(eq(biometric_machines.id, req.params.id));
  if (!existingRow) throw notFound('Biometric machine not found.');
  const machine = toMachine(existingRow);
  // No punch table is linked yet; once attendance punches are stored, block
  // deleting machines that have punches and require deactivation instead.
  await db.transaction(async (tx) => {
    await writeMasterAudit(tx, req, { masterKey: 'biometric_machine', recordId: machine.id, recordLabel: `${machine.fullName} (${machine.id})`, action: 'DELETE', before: machine, reason: reasonOf(req.body) });
    await tx.delete(biometric_machines).where(eq(biometric_machines.rowId, existingRow.rowId));
  });
  res.json({ success: true });
}));

// ===========================================================================
// Organization settings (name, logo, address, copyright) — single row "default"
// ===========================================================================

const LOGO_PREFIXES = ['data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,'];
const MAX_LOGO_CHARS = 2_800_000; // ≈ 2 MB image as base64

function toOrganization(row: typeof organization_settings.$inferSelect | undefined) {
  if (!row) return null;
  return {
    orgName: row.orgName,
    logoData: row.logoData ?? '',
    address: row.address ?? '',
    copyrightText: row.copyrightText ?? '',
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

// Public: the login page needs the name, logo and address before sign-in.
router.get('/organization', asyncHandler(async (_req, res) => {
  const [row] = await db.select().from(organization_settings).where(eq(organization_settings.id, 'default'));
  res.json(toOrganization(row));
}));

router.put('/organization', ...canEdit, asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  const orgName = v.string('orgName', { max: 255 });
  const address = v.optionalString('address', { max: 1000 }) ?? '';
  const copyrightText = v.optionalString('copyrightText', { max: 500 }) ?? '';
  const logoRaw = v.raw('logoData');
  const logoData = typeof logoRaw === 'string' && logoRaw ? logoRaw : null;
  if (logoData && (!LOGO_PREFIXES.some((p) => logoData.startsWith(p)) || logoData.length > MAX_LOGO_CHARS)) {
    v.errors.logoData = 'Logo must be a PNG, JPG or WEBP image under 2 MB.';
  }
  v.assert();

  const [beforeRow] = await db.select().from(organization_settings).where(eq(organization_settings.id, 'default'));
  const before = toOrganization(beforeRow);
  const saved = await db.transaction(async (tx) => {
    const values = { orgName, logoData, address: address || null, copyrightText: copyrightText || null };
    await tx.insert(organization_settings).values({ id: 'default', ...values }).onDuplicateKeyUpdate({ set: values });
    const [row] = await tx.select().from(organization_settings).where(eq(organization_settings.id, 'default'));
    const org = toOrganization(row)!;
    await writeMasterAudit(tx, req, {
      masterKey: 'organization_settings', recordId: 'default', recordLabel: org.orgName,
      action: before ? 'UPDATE' : 'CREATE', before, after: org, reason: reasonOf(req.body),
    });
    return org;
  });
  res.json(saved);
}));

export default router;
