import { notifyRolesChanged } from '../notifications/events';
import { clearAccessCache } from '../services/access.service';
import type { Request } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, notFound } from '../lib/http';
import { ModuleId, RoleId, normalizeModule, normalizeRole } from '../lib/roles';
import { inTransaction } from '../lib/tx';
import { findRole, loadCatalog } from '../lib/roleCatalog';
import { todayInIndia } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import { defaultPasswordHash } from '../masters/accountSettings';
import { photoUrls } from './photos';
import {
  EmployeeInput, FormLayout, LAYOUT_RULES, PROFILE_DATA_FORBIDDEN, PROFILE_DATA_KEYS, accountValidUpto, parseEmployeeInput, retirementDate,
} from './fields';
import { ResolvedReferences, checkReferences, layoutOfEmployeeType } from './references';
import { isSystemRow, systemAccountError } from '../lib/systemAccounts';
import { AADHAAR_REQUIRED, IDENTITY_STORED_KEYS, identityAudit, identityView, storeIdentity } from './identity';
import { identityOwner, loadIdentities, saveIdentity } from './identityStore';
import { placementValues, profileColumn, profileJsonSql, profileObject, profileValues } from './profileSql';
import { creditProRata, spanForNewEmployee, spansForExtension } from '../leave/proRata';

/**
 * Employee accounts and profiles. One save touches three tables in one
 * transaction, together with its audit record:
 *
 *   users               name, email, validity, status
 *   employee_profiles   salutation, department, designation, type, joining date, phone, shift and one column per
 *                       form field (profileSql.ts)
 *   employee_identity / employee_bank_accounts   Aadhaar, PAN, bank details (identityStore.ts)
 *   user_module_roles   the HRMS "User" role for a new employee (and nothing else)
 *   master_audit_logs   who changed what (before / after)
 */

type Querier = Pick<PoolConnection, 'query'> | typeof pool;

const AUDIT_EMPLOYEE = 'employee';
const AUDIT_ROLES = 'user_roles';
const AUDIT_PASSWORD = 'employee_password';

/** Role every new employee starts with (the role-matrix spelling for HRMS "User"). */
const NEW_EMPLOYEE_GRANT = { moduleId: 'hrms', roleId: 'hrms_staff' } as const;

const ROLE_RANK: RoleId[] = ['administrator', 'audit', 'leave_balance_manager', 'reviewing_manager', 'reporting_manager', 'general_staff'];

/** Module-specific "plain user" roles that, like HRMS User, carry no responsibilities. */
const PLAIN_USER_ROLES = new Set(['pms_researcher', 'sims_indenter', 'fin_claimant', 'fms_requester']);

async function rows(q: Querier, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await q.query<RowDataPacket[]>(sql, params);
  return result;
}

/** The profile object (form keys) from the JSON text of a record or the object built by profileJsonSql. */
const parseProfileData = (value: unknown): Record<string, unknown> => profileObject(value);

function dateText(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Runs a write that changes an account, its status or its roles, then drops the cached copies so the change is seen at once. */
function freshAccess<A extends unknown[], R>(write: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    try {
      return await write(...args);
    } finally {
      clearAccessCache();
    }
  };
}

export interface EmployeeRecord {
  id: string;
  biometricId: string;
  name: string;
  email: string;
  /** Fixed system account: shown in the Profiles table only; read-only. */
  isSystem: boolean;
  status: 'active' | 'inactive';
  /** The account cannot sign in because its validity date has passed (status `expired`; shown as inactive). */
  expired: boolean;
  validUpto: string | null;
  suffix: string | null;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  joiningDate: string | null;
  phone: string | null;
  officeLocation: string | null;
  /** Institute code (WII, SACON, …). */
  institute: string | null;
  shiftId: string | null;
  /** JSON text, kept as a string for older screens that parse it themselves. */
  profileData: string;
  /** Active grants as stored, per module: { hrms: ['hrms_admin', ...] }. */
  moduleRoles: Record<string, string[]>;
  /** Highest HRMS role and all HRMS roles, in canonical form. */
  role: RoleId;
  roles: RoleId[];
  /** Versioned address of the profile photo, or null for initials. */
  photoUrl: string | null;
}

const SELECT_EMPLOYEES = `
  SELECT u.id, u.biometric_id, u.name, u.email, u.status, u.valid_upto, u.is_system,
         p.suffix, p.department, p.designation, p.employment_type, p.joining_date,
         p.phone, p.office_location, p.institute, p.shift_id, ${profileJsonSql('p')} AS profile_data
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

/** Masked identity of each record, for the audit trail (kept beside the record, never sent to the browser). */
const identityForAudit = new WeakMap<EmployeeRecord, Record<string, unknown>>();

/** `fullIdentity`: full Aadhaar / account numbers (administrators); otherwise masked. */
function toRecord(row: RowDataPacket, grants: { moduleId: string; roleId: string }[], fullIdentity = false, identity: Record<string, unknown> = {}): EmployeeRecord {
  // `identity`: the stored Aadhaar / PAN / bank keys of identityStore (a preview passes them inside profile_data).
  const data = { ...parseProfileData(row.profile_data), ...identity };
  for (const key of PROFILE_DATA_FORBIDDEN) delete data[key];
  const audit = identityAudit(data);
  const shown = identityView(data, fullIdentity);
  for (const key of IDENTITY_STORED_KEYS) delete data[key];
  Object.assign(data, shown);

  const moduleRoles: Record<string, string[]> = {};
  const hrmsRoles: RoleId[] = [];
  for (const grant of grants) {
    const moduleId = normalizeModule(grant.moduleId) ?? grant.moduleId.toLowerCase();
    (moduleRoles[moduleId] ||= []).push(grant.roleId);
    const role = moduleId === 'hrms' ? normalizeRole(grant.roleId) : null;
    if (role && !hrmsRoles.includes(role)) hrmsRoles.push(role);
  }
  hrmsRoles.sort((a, b) => ROLE_RANK.indexOf(a) - ROLE_RANK.indexOf(b));

  const record: EmployeeRecord = {
    id: String(row.id),
    biometricId: String(row.biometric_id),
    name: String(row.name),
    email: String(row.email),
    isSystem: Number(row.is_system ?? 0) === 1,
    status: String(row.status).toLowerCase() === 'active' ? 'active' : 'inactive',
    expired: String(row.status).toLowerCase() === 'expired',
    validUpto: dateText(row.valid_upto),
    suffix: row.suffix ?? null,
    department: row.department || null,
    designation: row.designation || null,
    employmentType: row.employment_type ?? null,
    joiningDate: dateText(row.joining_date),
    phone: row.phone ?? null,
    officeLocation: row.office_location ?? null,
    institute: row.institute ?? null,
    shiftId: row.shift_id === null || row.shift_id === undefined ? null : String(row.shift_id),
    profileData: JSON.stringify(data),
    moduleRoles,
    role: hrmsRoles[0] ?? 'general_staff',
    roles: hrmsRoles,
    photoUrl: null,
  };
  identityForAudit.set(record, audit);
  return record;
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
  // Reporting managers / HoDs see their own people, and only while acting in that role.
  if (viewer.role !== 'reporting_manager' && viewer.role !== 'reviewing_manager') return false;
  const data = parseProfileData(record.profileData);
  return String(data.reportingManagerId ?? '') === String(viewer.id) || String(data.reviewingManagerId ?? '') === String(viewer.id);
}

/** `regular` (default): every employee except the system accounts. `system`: only those, for the Profiles table. */
export async function listEmployees(viewer: Viewer, which: 'regular' | 'system' = 'regular'): Promise<EmployeeRecord[]> {
  const found = await rows(pool, `${SELECT_EMPLOYEES} WHERE u.is_system = ${which === 'system' ? 1 : 0} ORDER BY u.name`);
  const grants = await loadGrants(pool, null);
  const identities = await loadIdentities(pool, null);
  const photos = await photoUrls(null);
  return found
    // Lists always carry masked Aadhaar / account numbers; the administrator's employee form reads one employee in full.
    .map((row) => ({ ...toRecord(row, grants.get(String(row.biometric_id)) ?? [], false, identities.get(String(row.biometric_id))), photoUrl: photos.get(String(row.biometric_id)) ?? null }))
    .map((record) => (canSeeFullProfile(viewer, record) ? record : publicView(record)));
}

async function findEmployee(q: Querier, id: number, lock = false, fullIdentity = false): Promise<{ record: EmployeeRecord; rawData: Record<string, unknown> } | null> {
  const [row] = await rows(q, `${SELECT_EMPLOYEES} WHERE u.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!row) return null;
  const grants = await loadGrants(q, [String(row.biometric_id)]);
  const identity = (await loadIdentities(q, [String(row.biometric_id)])).get(String(row.biometric_id)) ?? {};
  return {
    record: toRecord(row, grants.get(String(row.biometric_id)) ?? [], fullIdentity, identity),
    // Form keys + stored identity keys (the previous values a save works from).
    rawData: { ...parseProfileData(row.profile_data), ...identity },
  };
}

export async function getEmployee(viewer: Viewer, id: number): Promise<EmployeeRecord> {
  const found = await findEmployee(pool, id, false, viewer.role === 'administrator');
  if (!found) throw notFound('Employee not found.');
  if (!canSeeFullProfile(viewer, found.record)) throw new HttpError(403, 'You are not allowed to view this employee profile.', 'FORBIDDEN');
  const photos = await photoUrls([found.record.biometricId]);
  return { ...found.record, photoUrl: photos.get(found.record.biometricId) ?? null };
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
    phone: record.phone, officeLocation: record.officeLocation, institute: record.institute, shiftId: record.shiftId,
  };
  // Every form key is listed (null when empty) so a cleared field shows up as a change.
  for (const key of PROFILE_DATA_KEYS) view[key] = data[key] === undefined || data[key] === '' ? null : data[key];
  Object.assign(view, identityForAudit.get(record) ?? {});
  return view;
}

function grantsView(grants: { moduleId: string; roleId: string }[]): Record<string, unknown> {
  return { roles: grants.map((g) => `${normalizeModule(g.moduleId) ?? g.moduleId}:${g.roleId}`).sort().join(', ') };
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

/**
 * The profile object of a saved form (form keys, as profileJsonSql reads it back), including the values that are
 * worked out rather than stored (leave year, HoD name, default PI, superannuation date), so the audit trail and the
 * "nothing changed" check compare like with like.
 */
function profileDataFor(input: EmployeeInput, layout: FormLayout, refs: ResolvedReferences): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const fromForm: Record<string, unknown> = {
    gender: input.gender,
    dob: input.dob,
    bloodGroup: input.bloodGroup,
    leaveGroup: input.leaveGroup,
    leaveCycle: refs.leaveCycle,
    leaveCycleBasis: refs.leaveCycle === 'FY' ? 'financial_year' : 'calendar_year',
    employeeCategory: input.employeeCategory,
    permanentEmploymentType: input.permanentEmploymentType,
    reportingManagerId: input.reportingManagerId,
    reviewingManagerId: refs.reviewingManagerId,
    hodName: refs.hodName,
    validUntilDate: input.validUntilDate,
    isOnProbation: input.isOnProbation || undefined,
    isPwd: input.isPwd || undefined,
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

/** Whether the employee's department is an institute unit (false: a project), by what the layout allows. */
async function departmentIsOrgUnit(conn: Querier, layout: FormLayout, department: string | null): Promise<boolean> {
  const allowed = LAYOUT_RULES[layout]?.department;
  if (!department || allowed === 'projects') return false;
  if (allowed === 'organizations') return true;
  const [unit] = await rows(conn, 'SELECT 1 FROM organization_units WHERE name = ? LIMIT 1', [department]);
  return Boolean(unit);
}

/**
 * Column values of employee_profiles for a saved form. department / designation are generated columns (made from
 * org_unit_name / project_name and designation_name), so they are never written.
 */
async function profileColumns(conn: Querier, input: EmployeeInput, layout: FormLayout, refs: ResolvedReferences, data: Record<string, unknown>): Promise<Record<string, string | number | null>> {
  const values = profileValues(data);
  // A researcher's PI defaults to the reporting manager, worked out when reading; only a different name is stored.
  values.pi_name = input.piName && input.piName !== refs.reportingManagerName ? input.piName.slice(0, 255) : null;
  return {
    suffix: input.salutation,
    employment_type: input.employmentType,
    joining_date: input.joiningDate,
    phone: input.phone,
    institute: input.institute,
    shift_id: input.shiftId,
    ...placementValues(layout, {
      department: input.department,
      departmentIsOrgUnit: await departmentIsOrgUnit(conn, layout, input.department),
      designation: input.designation,
      courseProgram: input.courseProgram,
      courseBatch: input.courseBatch,
    }),
    ...values,
  };
}

async function prepare(conn: PoolConnection, body: unknown, selfId: number | null, previous: Record<string, unknown> = {}) {
  const employmentType = (body && typeof body === 'object' ? (body as Record<string, unknown>).employmentType : undefined);
  const layout = await layoutOfEmployeeType(conn, employmentType);
  // Blood group (and Aadhaar while AADHAAR_REQUIRED): required for a new employee. Once entered they cannot be
  // removed. Employees added before the field existed can still be saved without it.
  const input = parseEmployeeInput(body, layout, todayInIndia(), {
    aadhaar: (selfId === null && AADHAAR_REQUIRED) || Boolean(previous.aadhaarHash),
    bloodGroup: selfId === null || Boolean(previous.bloodGroup),
  });
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

/** Aadhaar, bank account (within a bank) and PAN belong to one employee only (the tables' UNIQUE keys also refuse it). */
async function assertIdentityUnique(conn: PoolConnection, keys: ReturnType<typeof storeIdentity>, biometricId: string) {
  const errors: Record<string, string> = {};
  const byAadhaar = await identityOwner(conn, 'aadhaar', keys.aadhaarHash, biometricId);
  if (byAadhaar) errors.aadhaarNumber = `This Aadhaar number is already registered to ${byAadhaar}.`;
  const byAccount = await identityOwner(conn, 'account', keys.accountHash, biometricId);
  if (byAccount) errors.bankAccountNumber = `This bank account is already registered to ${byAccount}.`;
  const byPan = await identityOwner(conn, 'pan', keys.pan, biometricId);
  if (byPan) errors.panNumber = `This PAN is already registered to ${byPan}.`;
  if (Object.keys(errors).length) throw new HttpError(409, 'These details belong to another employee.', 'DUPLICATE', errors);
}

function isDuplicateKey(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_DUP_ENTRY';
}

async function createEmployeeImpl(req: Request, body: unknown, temporaryPasswordHash?: string): Promise<EmployeeRecord> {
  // Every new account starts with its own temporary password (emailed to it; the route makes it) or, when none
  // is given, the default password, and is asked to choose its own password at first sign-in.
  const passwordHash = temporaryPasswordHash ?? await defaultPasswordHash();
  if (!passwordHash) {
    throw new HttpError(409, 'Set the default password for new employees first (Master Settings → Organization).', 'DEFAULT_PASSWORD_MISSING');
  }

  try {
    const id = await inTransaction((conn) => insertEmployee(conn, req, body, passwordHash, 'default (must be changed at first sign-in)'));
    return (await findEmployee(pool, id))!.record;
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(409, 'An account with this email or biometric ID already exists.', 'DUPLICATE');
    throw error;
  }
}
export const createEmployee = freshAccess(createEmployeeImpl);

/**
 * Creates one account + profile + HRMS User role inside the caller's transaction, with every check of the
 * employee form (also used by the bulk import, row by row). Returns the new account id.
 */
export async function insertEmployee(conn: PoolConnection, req: Request, body: unknown, passwordHash: string, passwordNote: string): Promise<number> {
  const actor = req.auth!.account.biometricId;
  const { layout, input, refs } = await prepare(conn, body, null);
  await assertUnique(conn, input, null);

  const [result] = await conn.query(
    `INSERT INTO users (biometric_id, name, email, password_hash, must_change_password, status, valid_upto, last_updated_by, last_updated_at, last_update_summary)
     VALUES (?, ?, ?, ?, 1, 'active', ?, ?, NOW(), ?)`,
    [input.biometricId, input.name, input.email, passwordHash, accountValidUpto(input, layout), actor, 'Employee profile created'],
  );
  const userId = Number((result as { insertId: number }).insertId);

  const newData = profileDataFor(input, layout, refs);
  await assertIdentityUnique(conn, storeIdentity(newData, input.identity, {}, layout), input.biometricId);
  const columns = await profileColumns(conn, input, layout, refs, newData);
  await conn.query(
    `INSERT INTO employee_profiles (biometric_id, ${Object.keys(columns).join(', ')}) VALUES (?, ${Object.keys(columns).map(() => '?').join(', ')})`,
    [input.biometricId, ...Object.values(columns)],
  );
  await saveIdentity(conn, input.biometricId, newData);

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
  await writeMasterAuditSql(conn, req, { masterKey: AUDIT_EMPLOYEE, recordId: input.biometricId, recordLabel: input.name, action: 'CREATE', after: { ...auditView(created), password: passwordNote } });
  await writeMasterAuditSql(conn, req, { masterKey: AUDIT_ROLES, recordId: input.biometricId, recordLabel: input.name, action: 'CREATE', after: grantsView([NEW_EMPLOYEE_GRANT]) });
  // Contract / Project / PhD / Intern: this leave year's quota, pro-rata from joining to "Valid up to".
  await creditProRata(conn, req, userId, { before: [], added: spanForNewEmployee(input.joiningDate, accountValidUpto(input, layout)), reason: 'new employee' });
  return userId;
}

/** Reads one account with its profile (for the bulk import's answer). */
export async function employeeById(id: number): Promise<EmployeeRecord | null> {
  return (await findEmployee(pool, id))?.record ?? null;
}

async function updateEmployeeImpl(req: Request, id: number, body: unknown): Promise<{ record: EmployeeRecord; changed: string[] }> {
  const actor = req.auth!.account.biometricId;
  try {
    return await inTransaction(async (conn) => {
      const existing = await findEmployee(conn, id, true);
      if (!existing) throw notFound('Employee account not found.');
      const before = existing.record;
      if (before.isSystem) throw systemAccountError();
      // An administrator's own profile is edited by another administrator.
      if (before.biometricId === actor) throw new HttpError(403, 'You cannot edit your own profile. Ask another administrator.', 'SELF');

      const sentId = body && typeof body === 'object' ? String((body as Record<string, unknown>).biometricId ?? '').trim() : '';
      if (sentId && sentId !== before.biometricId) {
        throw badRequest('Please correct the highlighted fields.', { biometricId: 'Biometric ID cannot be changed once the employee is created.' });
      }
      const { layout, input, refs } = await prepare(conn, { ...(body as object), biometricId: before.biometricId }, id, existing.rawData);
      await assertUnique(conn, input, id);

      const data = profileDataFor(input, layout, refs);
      await assertIdentityUnique(conn, storeIdentity(data, input.identity, existing.rawData, layout), before.biometricId);
      const columns = await profileColumns(conn, input, layout, refs, data);
      const validUpto = accountValidUpto(input, layout);

      // Work out the change before writing, so an unchanged save writes nothing.
      const preview = toRecord({
        id: before.id, biometric_id: before.biometricId, name: input.name, email: input.email, status: before.status,
        valid_upto: validUpto, office_location: before.officeLocation, ...columns,
        department: input.department ?? '', designation: input.designation ?? '', profile_data: data,
      } as unknown as RowDataPacket, []);
      const changed = changedFields(auditView(before), auditView(preview));
      if (changed.length === 0) return { record: before, changed };

      // A new validity date also moves the account between active and expired (accountBlock.statusForValidity):
      // extending it lets an expired account sign in again; ending it today or earlier expires an active one.
      const today = todayInIndia();
      await conn.query(
        `UPDATE users SET name = ?, email = ?, valid_upto = ?, last_updated_by = ?, last_updated_at = NOW(), last_update_summary = ?,
           status = CASE WHEN is_system = 0 AND LOWER(status) = 'expired' AND ? >= ? THEN 'active'
                         WHEN is_system = 0 AND LOWER(status) = 'active' AND ? < ? THEN 'expired' ELSE status END
          WHERE id = ?`,
        [input.name, input.email, validUpto, actor, `Profile updated: ${changed.join(', ')}`.slice(0, 1000), validUpto, today, validUpto, today, id],
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
      await saveIdentity(conn, before.biometricId, data);

      const after = (await findEmployee(conn, id))!.record;
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_EMPLOYEE, recordId: before.biometricId, recordLabel: input.name, action: 'UPDATE', before: auditView(before), after: auditView(after) });
      // Validity extended (also reactivates an expired account): add the pro-rata quota of the new months only.
      const extension = spansForExtension(after.joiningDate, before.validUpto, validUpto, before.validUpto !== null && before.validUpto < today, today);
      if (extension) await creditProRata(conn, req, id, extension, today);
      return { record: after, changed };
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(409, 'Another account already uses this email or mobile number.', 'DUPLICATE');
    throw error;
  }
}
export const updateEmployee = freshAccess(updateEmployeeImpl);

// ---------------------------------------------------------------------------
// Status and deletion
// ---------------------------------------------------------------------------

/**
 * Why an employee may not be deactivated or deleted, or null if they may. Only a plain User account can be: no other
 * role (Administrator, Auditor, manager, …) and nobody reporting to it; to be deactivated it must also hold the User
 * role in at least one module.
 */
async function responsibilityBlock(q: Querier, target: EmployeeRecord, deactivating = false): Promise<string | null> {
  const grants = Object.entries(target.moduleRoles).flatMap(([moduleId, roles]) => roles.map((roleId) => ({ moduleId, roleId })));
  const isUser = (roleId: string) => normalizeRole(roleId) === 'general_staff' || PLAIN_USER_ROLES.has(roleId.toLowerCase());
  // (Deactivation only: a wrongly created record without any role can still be deleted.)
  if (deactivating && !grants.some((g) => isUser(g.roleId))) {
    return 'no module has the User role assigned to this account. Give it the User role in the role matrix first.';
  }
  const privileged = grants.filter((g) => normalizeRole(g.roleId) !== 'general_staff' && !PLAIN_USER_ROLES.has(g.roleId.toLowerCase()));
  if (privileged.length) {
    return `remove these roles first in the role matrix: ${privileged.map((g) => `${g.moduleId}: ${g.roleId}`).join(', ')}.`;
  }
  const [managed] = await rows(q,
    `SELECT COUNT(*) AS n FROM employee_profiles
      WHERE biometric_id <> ? AND (reporting_manager_id = ? OR reviewing_manager_id = ?)`,
    [target.biometricId, target.id, target.id]);
  const n = Number(managed?.n ?? 0);
  if (n > 0) return `they are the reporting manager or HoD of ${n} employee${n === 1 ? '' : 's'}; reassign them first.`;
  return null;
}

/** For the screen: whether the account can be deactivated now, and if not, why (the same check as the change itself). */
export async function deactivationCheck(id: number): Promise<{ allowed: boolean; reason: string | null }> {
  const found = await findEmployee(pool, id, false);
  if (!found) throw notFound('Employee account not found.');
  if (found.record.isSystem) return { allowed: false, reason: 'System accounts cannot be deactivated.' };
  const block = await responsibilityBlock(pool, found.record, true);
  return { allowed: !block, reason: block ? `Deactivation blocked: ${block}` : null };
}

export interface StatusChange { status: 'active' | 'inactive'; reason: string; effectiveDate: string }

async function setEmployeeStatusImpl(req: Request, id: number, change: StatusChange, temporaryPasswordHash?: string): Promise<EmployeeRecord> {
  const actor = req.auth!.account.biometricId;
  return inTransaction(async (conn) => {
    const existing = await findEmployee(conn, id, true);
    if (!existing) throw notFound('Employee account not found.');
    const before = existing.record;
    if (before.isSystem) throw systemAccountError();
    if (before.biometricId === actor) throw badRequest('You cannot change your own account status.');
    // Nothing to change. (A refusal, not a silent success: a reactivation would otherwise email a temporary password that was never saved.)
    if (before.status === change.status) throw new HttpError(409, `The account is already ${change.status === 'active' ? 'active' : 'inactive'}.`, 'NO_CHANGE');

    if (change.status === 'inactive') {
      const block = await responsibilityBlock(conn, before, true);
      if (block) throw new HttpError(409, `Deactivation blocked: ${block}`, 'IN_USE');
    }

    if (change.status === 'active' && before.validUpto && before.validUpto < todayInIndia()) {
      throw new HttpError(409, `The account's validity ended on ${before.validUpto}. Extend "Valid up to" in the profile first; that reactivates it.`, 'VALIDITY_ENDED');
    }

    const verb = change.status === 'inactive' ? 'Deactivated' : 'Reactivated';
    // A reactivated account signs in with the default password again and is offered (not forced) to choose its own, once.
    const resetHash = change.status === 'active' ? temporaryPasswordHash ?? await defaultPasswordHash(conn) : null;
    if (change.status === 'active' && !resetHash) {
      throw new HttpError(409, 'Set the default password first (Master Settings → Organization).', 'DEFAULT_PASSWORD_MISSING');
    }
    await conn.query(
      `UPDATE users SET status = ?, last_updated_by = ?, last_updated_at = NOW(), last_update_summary = ?${resetHash ? ', password_hash = ?, must_change_password = 1' : ''} WHERE id = ?`,
      [change.status, actor, `${verb} effective ${change.effectiveDate}${change.reason ? `: ${change.reason}` : ''}`.slice(0, 1000), ...(resetHash ? [resetHash] : []), id],
    );
    await conn.query(
      `UPDATE employee_profiles SET ${profileColumn('statusChangeReason')} = ?, ${profileColumn('statusEffectiveDate')} = ?, ${profileColumn('statusChangedBy')} = ?
        WHERE biometric_id = ?`,
      [change.reason ? change.reason.slice(0, 500) : null, change.effectiveDate, actor, before.biometricId]);

    // Reactivated: the running leave year's pro-rata quota from today, if the year has no balance yet
    // (a deactivation and reactivation within the same year keeps the balance as it was).
    if (change.status === 'active') {
      const today = todayInIndia();
      await creditProRata(conn, req, id, { before: [], added: { from: today, to: before.validUpto || '9999-12-31' }, onlyMissing: true, reason: `reactivated on ${today}` }, today);
    }
    const after = (await findEmployee(conn, id))!.record;
    await writeMasterAuditSql(conn, req, {
      masterKey: AUDIT_EMPLOYEE, recordId: before.biometricId, recordLabel: before.name, action: 'STATUS',
      before: { status: before.status, effectiveDate: existing.rawData.statusEffectiveDate ?? null },
      after: { status: after.status, effectiveDate: change.effectiveDate, ...(resetHash ? { password: temporaryPasswordHash ? 'temporary password emailed (change offered at sign-in)' : 'default (change offered at first sign-in)' } : {}) },
      reason: change.reason || null,
    });
    return after;
  });
}
export const setEmployeeStatus = freshAccess(setEmployeeStatusImpl);

async function deleteEmployeeImpl(req: Request, id: number, reason: string, reference: string | null): Promise<EmployeeRecord> {
  const actor = req.auth!.account.biometricId;
  return inTransaction(async (conn) => {
    const existing = await findEmployee(conn, id, true);
    if (!existing) throw notFound('Employee account not found.');
    const target = existing.record;
    if (target.isSystem) throw systemAccountError();
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
    await conn.query('DELETE FROM employee_bank_accounts WHERE biometric_id = ?', [target.biometricId]);
    await conn.query('DELETE FROM employee_identity WHERE biometric_id = ?', [target.biometricId]);
    await conn.query('DELETE FROM employee_profiles WHERE biometric_id = ?', [target.biometricId]);
    await conn.query('DELETE FROM user_module_roles WHERE biometric_id = ?', [target.biometricId]);
    await conn.query('DELETE FROM users WHERE id = ?', [id]);
    return target;
  });
}
export const deleteEmployee = freshAccess(deleteEmployeeImpl);

// ---------------------------------------------------------------------------
// Module roles and password resets
// ---------------------------------------------------------------------------

export interface Grant { moduleId: ModuleId; roleId: string }

/**
 * Replaces a user's whole module-role matrix. Existing rows are switched
 * active/inactive (history is kept) and new ones inserted, with one audit record.
 */
async function replaceRoleGrantsImpl(req: Request, biometricId: string, wanted: Grant[]): Promise<void> {
  const actor = req.auth!.account.biometricId;
  const catalog = await loadCatalog();
  const changed = await inTransaction(async (conn) => {
    const [user] = await rows(conn, 'SELECT id, name, is_system FROM users WHERE biometric_id = ? LIMIT 1', [biometricId]);
    if (!user) throw notFound('User account not found.');
    if (isSystemRow(user)) throw systemAccountError();

    const existing = await rows(conn, 'SELECT id, module_id, role_id, status FROM user_module_roles WHERE biometric_id = ? FOR UPDATE', [biometricId]);
    // The same catalog role in another spelling (an older grant "Co-PI" vs "Co-Principal Investigator (Co-PI)") is the same grant.
    const keyOf = (moduleId: string, roleId: string) => {
      const entry = findRole(catalog, moduleId, roleId);
      return entry ? `${entry.moduleId}::${entry.roleId}` : `${normalizeModule(moduleId) ?? moduleId.toLowerCase()}::${roleId}`;
    };
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
      return true;
    }
    return false;
  });
  if (changed) notifyRolesChanged(biometricId, wanted);
}
export const replaceRoleGrants = freshAccess(replaceRoleGrantsImpl);

/** Records a password reset. Only how and why it was done is kept, never the password. */
export async function auditPasswordReset(req: Request, target: { biometricId: string; name: string }, details: { mode: string; emailStatus: string; reason: string }): Promise<void> {
  await writeMasterAuditSql(pool, req, {
    masterKey: AUDIT_PASSWORD, recordId: target.biometricId, recordLabel: target.name, action: 'RESET',
    after: { mode: details.mode, emailStatus: details.emailStatus }, reason: details.reason || null,
  });
}
