import type { Request } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, notFound } from '../lib/http';
import { ModuleId, RoleId, normalizeModule, normalizeRole } from '../lib/roles';
import { inTransaction } from '../lib/tx';
import { todayInIndia } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import { defaultPasswordHash } from '../masters/accountSettings';
import {
  EmployeeInput, FormLayout, PROFILE_DATA_FORBIDDEN, PROFILE_DATA_KEYS, accountValidUpto, parseEmployeeInput, retirementDate,
} from './fields';
import { ResolvedReferences, checkReferences, layoutOfEmployeeType } from './references';

/**
 * Employee accounts and profiles. One save touches three tables in one
 * transaction, together with its audit record:
 *
 *   users               name, email, validity, status
 *   employee_profiles   salutation, department, designation, type, joining date, phone, shift, profile_data
 *   user_module_roles   the HRMS "User" role for a new employee (and nothing else)
 *   master_audit_logs   who changed what (before / after)
 */

type Querier = Pick<PoolConnection, 'query'> | typeof pool;

const AUDIT_EMPLOYEE = 'employee';
const AUDIT_ROLES = 'user_roles';
const AUDIT_PASSWORD = 'employee_password';

/** Role every new employee starts with (the role-matrix spelling for HRMS "User"). */
const NEW_EMPLOYEE_GRANT = { moduleId: 'hrms', roleId: 'hrms_staff' } as const;

const ROLE_RANK: RoleId[] = ['administrator', 'audit', 'reviewing_manager', 'reporting_manager', 'general_staff'];

/** Module-specific "plain user" roles that, like HRMS User, carry no responsibilities. */
const PLAIN_USER_ROLES = new Set(['pms_researcher', 'sims_indenter', 'fin_claimant', 'fms_requester']);

async function rows(q: Querier, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await q.query<RowDataPacket[]>(sql, params);
  return result;
}

function parseProfileData(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function dateText(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface EmployeeRecord {
  id: string;
  biometricId: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  validUpto: string | null;
  suffix: string | null;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  joiningDate: string | null;
  phone: string | null;
  officeLocation: string | null;
  shiftId: string | null;
  /** JSON text, kept as a string for older screens that parse it themselves. */
  profileData: string;
  /** Active grants as stored, per module: { hrms: ['hrms_admin', ...] }. */
  moduleRoles: Record<string, string[]>;
  /** Highest HRMS role and all HRMS roles, in canonical form. */
  role: RoleId;
  roles: RoleId[];
}

const SELECT_EMPLOYEES = `
  SELECT u.id, u.biometric_id, u.name, u.email, u.status, u.valid_upto,
         p.suffix, p.department, p.designation, p.employment_type, p.joining_date,
         p.phone, p.office_location, p.shift_id, p.profile_data
    FROM users u
    LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id`;

async function loadGrants(q: Querier, biometricIds: string[] | null): Promise<Map<string, { moduleId: string; roleId: string }[]>> {
  const out = new Map<string, { moduleId: string; roleId: string }[]>();
  if (biometricIds && biometricIds.length === 0) return out;
  const where = biometricIds ? ` AND biometric_id IN (${biometricIds.map(() => '?').join(',')})` : '';
  const found = await rows(q, `SELECT biometric_id, module_id, role_id FROM user_module_roles WHERE LOWER(status) = 'active'${where}`, biometricIds ?? []);
  for (const row of found) {
    const list = out.get(String(row.biometric_id)) ?? [];
    list.push({ moduleId: String(row.module_id), roleId: String(row.role_id) });
    out.set(String(row.biometric_id), list);
  }
  return out;
}

function toRecord(row: RowDataPacket, grants: { moduleId: string; roleId: string }[]): EmployeeRecord {
  const data = parseProfileData(row.profile_data);
  for (const key of PROFILE_DATA_FORBIDDEN) delete data[key];

  const moduleRoles: Record<string, string[]> = {};
  const hrmsRoles: RoleId[] = [];
  for (const grant of grants) {
    const moduleId = normalizeModule(grant.moduleId) ?? grant.moduleId.toLowerCase();
    (moduleRoles[moduleId] ||= []).push(grant.roleId);
    const role = moduleId === 'hrms' ? normalizeRole(grant.roleId) : null;
    if (role && !hrmsRoles.includes(role)) hrmsRoles.push(role);
  }
  hrmsRoles.sort((a, b) => ROLE_RANK.indexOf(a) - ROLE_RANK.indexOf(b));

  return {
    id: String(row.id),
    biometricId: String(row.biometric_id),
    name: String(row.name),
    email: String(row.email),
    status: String(row.status).toLowerCase() === 'active' ? 'active' : 'inactive',
    validUpto: dateText(row.valid_upto),
    suffix: row.suffix ?? null,
    department: row.department || null,
    designation: row.designation || null,
    employmentType: row.employment_type ?? null,
    joiningDate: dateText(row.joining_date),
    phone: row.phone ?? null,
    officeLocation: row.office_location ?? null,
    shiftId: row.shift_id === null || row.shift_id === undefined ? null : String(row.shift_id),
    profileData: JSON.stringify(data),
    moduleRoles,
    role: hrmsRoles[0] ?? 'general_staff',
    roles: hrmsRoles,
  };
}

/** Fields of another employee that any signed-in user may see (names for dropdowns, managers, …). */
function publicView(record: EmployeeRecord): EmployeeRecord {
  const data = parseProfileData(record.profileData);
  const keep = { reportingManagerId: data.reportingManagerId, reviewingManagerId: data.reviewingManagerId, hodName: data.hodName };
  return {
    ...record,
    validUpto: null, joiningDate: null, phone: null, officeLocation: null, shiftId: null,
    profileData: JSON.stringify(keep),
  };
}

export interface Viewer { id: number; role: RoleId | null }

/** Full details for administrators, auditors, the employee and their managers; basic details otherwise. */
export function canSeeFullProfile(viewer: Viewer, record: EmployeeRecord): boolean {
  if (viewer.role === 'administrator' || viewer.role === 'audit') return true;
  if (record.id === String(viewer.id)) return true;
  const data = parseProfileData(record.profileData);
  return String(data.reportingManagerId ?? '') === String(viewer.id) || String(data.reviewingManagerId ?? '') === String(viewer.id);
}

export async function listEmployees(viewer: Viewer): Promise<EmployeeRecord[]> {
  const found = await rows(pool, `${SELECT_EMPLOYEES} ORDER BY u.name`);
  const grants = await loadGrants(pool, null);
  return found
    .map((row) => toRecord(row, grants.get(String(row.biometric_id)) ?? []))
    .map((record) => (canSeeFullProfile(viewer, record) ? record : publicView(record)));
}

async function findEmployee(q: Querier, id: number, lock = false): Promise<{ record: EmployeeRecord; rawData: Record<string, unknown> } | null> {
  const [row] = await rows(q, `${SELECT_EMPLOYEES} WHERE u.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!row) return null;
  const grants = await loadGrants(q, [String(row.biometric_id)]);
  return {
    record: toRecord(row, grants.get(String(row.biometric_id)) ?? []),
    rawData: parseProfileData(row.profile_data),
  };
}

export async function getEmployee(viewer: Viewer, id: number): Promise<EmployeeRecord> {
  const found = await findEmployee(pool, id);
  if (!found) throw notFound('Employee not found.');
  if (!canSeeFullProfile(viewer, found.record)) throw new HttpError(403, 'You are not allowed to view this employee profile.', 'FORBIDDEN');
  return found.record;
}

// ---------------------------------------------------------------------------
// Audit views
// ---------------------------------------------------------------------------

/** Flat picture of an employee for the audit trail (no secrets, no large values). */
function auditView(record: EmployeeRecord): Record<string, unknown> {
  const data = parseProfileData(record.profileData);
  const view: Record<string, unknown> = {
    biometricId: record.biometricId, name: record.name, email: record.email, status: record.status,
    validUpto: record.validUpto, salutation: record.suffix, department: record.department,
    designation: record.designation, employmentType: record.employmentType, joiningDate: record.joiningDate,
    phone: record.phone, officeLocation: record.officeLocation, shiftId: record.shiftId,
  };
  // Every form key is listed (null when empty) so a cleared field shows up as a change.
  for (const key of PROFILE_DATA_KEYS) view[key] = data[key] === undefined || data[key] === '' ? null : data[key];
  return view;
}

function grantsView(grants: { moduleId: string; roleId: string }[]): Record<string, unknown> {
  return { roles: grants.map((g) => `${normalizeModule(g.moduleId) ?? g.moduleId}:${g.roleId}`).sort().join(', ') };
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

function profileDataFor(input: EmployeeInput, layout: FormLayout, refs: ResolvedReferences, previous: Record<string, unknown>): Record<string, unknown> {
  // Keep what other screens store here (leave balances, avatar, …) but replace every form field.
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(previous)) {
    if (!PROFILE_DATA_FORBIDDEN.has(key) && !(PROFILE_DATA_KEYS as readonly string[]).includes(key)) data[key] = value;
  }
  const fromForm: Record<string, unknown> = {
    gender: input.gender,
    dob: input.dob,
    leaveCycle: input.leaveCycle,
    leaveCycleBasis: input.leaveCycle === 'FY' ? 'financial_year' : 'calendar_year',
    employeeCategory: input.employeeCategory,
    permanentEmploymentType: input.permanentEmploymentType,
    reportingManagerId: input.reportingManagerId,
    reviewingManagerId: refs.reviewingManagerId,
    hodName: refs.hodName,
    validUntilDate: input.validUntilDate,
    isOnProbation: input.isOnProbation || undefined,
    probationEndDate: input.probationEndDate,
    isPhDEnrolled: input.isPhDEnrolled || undefined,
    piName: input.piName ?? (layout === 'researcher' ? refs.reportingManagerName : null),
    courseProgram: input.courseProgram,
    courseBatch: input.courseBatch,
    enrolledThrough: input.enrolledThrough,
    guideSupervisor: input.guideSupervisor,
    retirementDate: layout === 'permanent' ? retirementDate(input.dob) : null,
  };
  for (const [key, value] of Object.entries(fromForm)) {
    if (value !== null && value !== undefined && value !== '') data[key] = value;
  }
  return data;
}

function profileColumns(input: EmployeeInput, data: Record<string, unknown>) {
  return {
    suffix: input.salutation,
    // department / designation are NOT NULL in the database; types without them store ''.
    department: input.department ?? '',
    designation: input.designation ?? '',
    employment_type: input.employmentType,
    joining_date: input.joiningDate,
    phone: input.phone,
    office_location: input.officeLocation,
    shift_id: input.shiftId,
    profile_data: JSON.stringify(data),
  };
}

async function prepare(conn: PoolConnection, body: unknown, selfId: number | null) {
  const employmentType = (body && typeof body === 'object' ? (body as Record<string, unknown>).employmentType : undefined);
  const layout = await layoutOfEmployeeType(conn, employmentType);
  const input = parseEmployeeInput(body, layout, todayInIndia());
  const refs = await checkReferences(conn, input, layout!, selfId);
  return { layout: layout!, input, refs };
}

/** Last 10 digits of a mobile number: the part that identifies it. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

async function assertUnique(conn: PoolConnection, input: EmployeeInput, selfId: number | null) {
  const errors: Record<string, string> = {};
  const [byEmail] = await rows(conn, 'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [input.email]);
  if (byEmail && Number(byEmail.id) !== selfId) errors.email = 'Another account already uses this email.';
  // Mobile numbers are compared on their last 10 digits, so 0XXXXXXXXXX, +91XXXXXXXXXX and XXXXXXXXXX are the same number.
  const [byPhone] = await rows(conn,
    `SELECT u.id, u.name FROM employee_profiles p JOIN users u ON u.biometric_id = p.biometric_id
      WHERE RIGHT(REPLACE(REPLACE(REPLACE(p.phone, ' ', ''), '-', ''), '+', ''), 10) = ? AND u.id <> ? LIMIT 1`,
    [phoneKey(input.phone), selfId ?? 0]);
  if (byPhone) errors.phone = `This mobile number is already registered to ${byPhone.name}.`;
  if (selfId === null) {
    const [byId] = await rows(conn, 'SELECT id FROM users WHERE biometric_id = ? LIMIT 1', [input.biometricId]);
    const [profile] = await rows(conn, 'SELECT id FROM employee_profiles WHERE biometric_id = ? LIMIT 1', [input.biometricId]);
    if (byId || profile) errors.biometricId = 'This biometric ID is already in use.';
  }
  if (Object.keys(errors).length) throw new HttpError(409, 'This employee already exists.', 'DUPLICATE', errors);
}

function isDuplicateKey(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_DUP_ENTRY';
}

export async function createEmployee(req: Request, body: unknown): Promise<EmployeeRecord> {
  const actor = req.auth!.account.biometricId;
  // Every new account starts with the default password (a copy of its hash)
  // and must choose its own password at first sign-in.
  const passwordHash = await defaultPasswordHash();
  if (!passwordHash) {
    throw new HttpError(409, 'Set the default password for new employees first (Master Settings → Organization).', 'DEFAULT_PASSWORD_MISSING');
  }

  try {
    const id = await inTransaction(async (conn) => {
      const { layout, input, refs } = await prepare(conn, body, null);
      await assertUnique(conn, input, null);

      const [result] = await conn.query(
        `INSERT INTO users (biometric_id, name, email, password_hash, must_change_password, status, valid_upto, last_updated_by, last_updated_at, last_update_summary)
         VALUES (?, ?, ?, ?, 1, 'active', ?, ?, NOW(), ?)`,
        [input.biometricId, input.name, input.email, passwordHash, accountValidUpto(input, layout), actor, 'Employee profile created'],
      );
      const userId = Number((result as { insertId: number }).insertId);

      const columns = profileColumns(input, profileDataFor(input, layout, refs, {}));
      await conn.query(
        `INSERT INTO employee_profiles (biometric_id, ${Object.keys(columns).join(', ')}) VALUES (?, ${Object.keys(columns).map(() => '?').join(', ')})`,
        [input.biometricId, ...Object.values(columns)],
      );

      // A new employee holds exactly one role: HRMS User. Rows left behind for this
      // biometric ID (e.g. imported data) are switched off, never reused.
      await conn.query(
        `UPDATE user_module_roles SET status = 'inactive', last_updated_by = ?
          WHERE biometric_id = ? AND LOWER(status) = 'active' AND NOT (module_id = ? AND role_id = ?)`,
        [actor, input.biometricId, NEW_EMPLOYEE_GRANT.moduleId, NEW_EMPLOYEE_GRANT.roleId],
      );
      const [existingGrant] = await rows(conn,
        'SELECT id FROM user_module_roles WHERE biometric_id = ? AND module_id = ? AND role_id = ? LIMIT 1',
        [input.biometricId, NEW_EMPLOYEE_GRANT.moduleId, NEW_EMPLOYEE_GRANT.roleId]);
      if (existingGrant) {
        await conn.query("UPDATE user_module_roles SET status = 'active', last_updated_by = ? WHERE id = ?", [actor, existingGrant.id]);
      } else {
        await conn.query(
          "INSERT INTO user_module_roles (biometric_id, module_id, role_id, status, last_updated_by) VALUES (?, ?, ?, 'active', ?)",
          [input.biometricId, NEW_EMPLOYEE_GRANT.moduleId, NEW_EMPLOYEE_GRANT.roleId, actor],
        );
      }

      const created = (await findEmployee(conn, userId))!.record;
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_EMPLOYEE, recordId: input.biometricId, recordLabel: input.name, action: 'CREATE', after: { ...auditView(created), password: 'default (must be changed at first sign-in)' } });
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_ROLES, recordId: input.biometricId, recordLabel: input.name, action: 'CREATE', after: grantsView([NEW_EMPLOYEE_GRANT]) });
      return userId;
    });
    return (await findEmployee(pool, id))!.record;
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(409, 'An account with this email or biometric ID already exists.', 'DUPLICATE');
    throw error;
  }
}

export async function updateEmployee(req: Request, id: number, body: unknown): Promise<{ record: EmployeeRecord; changed: string[] }> {
  const actor = req.auth!.account.biometricId;
  try {
    return await inTransaction(async (conn) => {
      const existing = await findEmployee(conn, id, true);
      if (!existing) throw notFound('Employee account not found.');
      const before = existing.record;

      const sentId = body && typeof body === 'object' ? String((body as Record<string, unknown>).biometricId ?? '').trim() : '';
      if (sentId && sentId !== before.biometricId) {
        throw badRequest('Please correct the highlighted fields.', { biometricId: 'Biometric ID cannot be changed once the employee is created.' });
      }
      const { layout, input, refs } = await prepare(conn, { ...(body as object), biometricId: before.biometricId }, id);
      await assertUnique(conn, input, id);

      const data = profileDataFor(input, layout, refs, existing.rawData);
      const columns = profileColumns(input, data);
      const validUpto = accountValidUpto(input, layout);

      // Work out the change before writing, so an unchanged save writes nothing.
      const preview = toRecord({
        id: before.id, biometric_id: before.biometricId, name: input.name, email: input.email, status: before.status,
        valid_upto: validUpto, ...columns,
      } as unknown as RowDataPacket, []);
      const changed = changedFields(auditView(before), auditView(preview));
      if (changed.length === 0) return { record: before, changed };

      await conn.query(
        'UPDATE users SET name = ?, email = ?, valid_upto = ?, last_updated_by = ?, last_updated_at = NOW(), last_update_summary = ? WHERE id = ?',
        [input.name, input.email, validUpto, actor, `Profile updated: ${changed.join(', ')}`.slice(0, 1000), id],
      );
      const [profileRow] = await rows(conn, 'SELECT id FROM employee_profiles WHERE biometric_id = ? LIMIT 1', [before.biometricId]);
      if (profileRow) {
        await conn.query(
          `UPDATE employee_profiles SET ${Object.keys(columns).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
          [...Object.values(columns), profileRow.id],
        );
      } else {
        await conn.query(
          `INSERT INTO employee_profiles (biometric_id, ${Object.keys(columns).join(', ')}) VALUES (?, ${Object.keys(columns).map(() => '?').join(', ')})`,
          [before.biometricId, ...Object.values(columns)],
        );
      }

      const after = (await findEmployee(conn, id))!.record;
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_EMPLOYEE, recordId: before.biometricId, recordLabel: input.name, action: 'UPDATE', before: auditView(before), after: auditView(after) });
      return { record: after, changed };
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(409, 'Another account already uses this email or mobile number.', 'DUPLICATE');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Status and deletion
// ---------------------------------------------------------------------------

/** Why an employee may not be deactivated or deleted, or null if they may. */
async function responsibilityBlock(q: Querier, target: EmployeeRecord): Promise<string | null> {
  const grants = Object.entries(target.moduleRoles).flatMap(([moduleId, roles]) => roles.map((roleId) => ({ moduleId, roleId })));
  const privileged = grants.filter((g) => normalizeRole(g.roleId) !== 'general_staff' && !PLAIN_USER_ROLES.has(g.roleId.toLowerCase()));
  if (privileged.length) {
    return `remove these roles first in the role matrix: ${privileged.map((g) => `${g.moduleId}: ${g.roleId}`).join(', ')}.`;
  }
  const [managed] = await rows(q,
    `SELECT COUNT(*) AS n FROM employee_profiles
      WHERE biometric_id <> ? AND JSON_VALID(profile_data)
        AND (JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.reportingManagerId')) = ?
          OR JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.reviewingManagerId')) = ?)`,
    [target.biometricId, target.id, target.id]);
  const n = Number(managed?.n ?? 0);
  if (n > 0) return `they are the reporting manager or HoD of ${n} employee${n === 1 ? '' : 's'}; reassign them first.`;
  return null;
}

export interface StatusChange { status: 'active' | 'inactive'; reason: string; effectiveDate: string }

export async function setEmployeeStatus(req: Request, id: number, change: StatusChange): Promise<EmployeeRecord> {
  const actor = req.auth!.account.biometricId;
  return inTransaction(async (conn) => {
    const existing = await findEmployee(conn, id, true);
    if (!existing) throw notFound('Employee account not found.');
    const before = existing.record;
    if (before.biometricId === actor) throw badRequest('You cannot change your own account status.');
    if (before.status === change.status) return before;

    if (change.status === 'inactive') {
      const block = await responsibilityBlock(conn, before);
      if (block) throw new HttpError(409, `Deactivation blocked: ${block}`, 'IN_USE');
    }

    const verb = change.status === 'inactive' ? 'Deactivated' : 'Reactivated';
    await conn.query(
      'UPDATE users SET status = ?, last_updated_by = ?, last_updated_at = NOW(), last_update_summary = ? WHERE id = ?',
      [change.status, actor, `${verb} effective ${change.effectiveDate}${change.reason ? `: ${change.reason}` : ''}`.slice(0, 1000), id],
    );
    const data: Record<string, unknown> = { ...existing.rawData, statusChangeReason: change.reason, statusEffectiveDate: change.effectiveDate, statusChangedBy: actor };
    delete data.status;
    await conn.query('UPDATE employee_profiles SET profile_data = ? WHERE biometric_id = ?', [JSON.stringify(data), before.biometricId]);

    const after = (await findEmployee(conn, id))!.record;
    await writeMasterAuditSql(conn, req, {
      masterKey: AUDIT_EMPLOYEE, recordId: before.biometricId, recordLabel: before.name, action: 'STATUS',
      before: { status: before.status, effectiveDate: existing.rawData.statusEffectiveDate ?? null },
      after: { status: after.status, effectiveDate: change.effectiveDate },
      reason: change.reason || null,
    });
    return after;
  });
}

export async function deleteEmployee(req: Request, id: number, reason: string, reference: string | null): Promise<EmployeeRecord> {
  const actor = req.auth!.account.biometricId;
  return inTransaction(async (conn) => {
    const existing = await findEmployee(conn, id, true);
    if (!existing) throw notFound('Employee account not found.');
    const target = existing.record;
    if (target.biometricId === actor) throw new HttpError(409, 'You cannot delete your own account.', 'SELF');

    const block = await responsibilityBlock(conn, target);
    if (block) throw new HttpError(409, `Deletion blocked: ${block}`, 'IN_USE');

    await conn.query(
      `INSERT INTO user_account_audit_logs (target_biometric_id, target_name, target_email, action, reason, reference, deleted_by, deleted_at)
       VALUES (?, ?, ?, 'DELETE', ?, ?, ?, NOW())`,
      [target.biometricId, target.name, target.email, reason, reference, actor],
    );
    await writeMasterAuditSql(conn, req, {
      masterKey: AUDIT_EMPLOYEE, recordId: target.biometricId, recordLabel: target.name, action: 'DELETE',
      before: { ...auditView(target), ...grantsView(Object.entries(target.moduleRoles).flatMap(([moduleId, roles]) => roles.map((roleId) => ({ moduleId, roleId })))) },
      reason: reference ? `${reason} (ref: ${reference})` : reason,
    });
    await conn.query('DELETE FROM employee_profiles WHERE biometric_id = ?', [target.biometricId]);
    await conn.query('DELETE FROM user_module_roles WHERE biometric_id = ?', [target.biometricId]);
    await conn.query('DELETE FROM users WHERE id = ?', [id]);
    return target;
  });
}

// ---------------------------------------------------------------------------
// Module roles and password resets
// ---------------------------------------------------------------------------

export interface Grant { moduleId: ModuleId; roleId: string }

/**
 * Replaces a user's whole module-role matrix. Existing rows are switched
 * active/inactive (history is kept) and new ones inserted, with one audit record.
 */
export async function replaceRoleGrants(req: Request, biometricId: string, wanted: Grant[]): Promise<void> {
  const actor = req.auth!.account.biometricId;
  await inTransaction(async (conn) => {
    const [user] = await rows(conn, 'SELECT id, name FROM users WHERE biometric_id = ? LIMIT 1', [biometricId]);
    if (!user) throw notFound('User account not found.');

    const existing = await rows(conn, 'SELECT id, module_id, role_id, status FROM user_module_roles WHERE biometric_id = ? FOR UPDATE', [biometricId]);
    const keyOf = (moduleId: string, roleId: string) => `${normalizeModule(moduleId) ?? moduleId.toLowerCase()}::${roleId}`;
    const before = existing.filter((r) => String(r.status).toLowerCase() === 'active').map((r) => ({ moduleId: String(r.module_id), roleId: String(r.role_id) }));
    const pending = new Map(wanted.map((g) => [keyOf(g.moduleId, g.roleId), g]));

    for (const row of existing) {
      const key = keyOf(String(row.module_id), String(row.role_id));
      const next = pending.has(key) ? 'active' : 'inactive';
      pending.delete(key);
      if (String(row.status).toLowerCase() === next) continue;
      await conn.query('UPDATE user_module_roles SET status = ?, last_updated_by = ? WHERE id = ?', [next, actor, row.id]);
    }
    for (const grant of pending.values()) {
      await conn.query(
        "INSERT INTO user_module_roles (biometric_id, module_id, role_id, status, last_updated_by) VALUES (?, ?, ?, 'active', ?)",
        [biometricId, grant.moduleId, grant.roleId, actor],
      );
    }

    const beforeView = grantsView(before);
    const afterView = grantsView(wanted);
    if (beforeView.roles !== afterView.roles) {
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_ROLES, recordId: biometricId, recordLabel: String(user.name), action: 'UPDATE', before: beforeView, after: afterView });
    }
  });
}

/** Records a password reset. Only how and why it was done is kept, never the password. */
export async function auditPasswordReset(req: Request, target: { biometricId: string; name: string }, details: { mode: string; emailStatus: string; reason: string }): Promise<void> {
  await writeMasterAuditSql(pool, req, {
    masterKey: AUDIT_PASSWORD, recordId: target.biometricId, recordLabel: target.name, action: 'RESET',
    after: { mode: details.mode, emailStatus: details.emailStatus }, reason: details.reason || null,
  });
}
