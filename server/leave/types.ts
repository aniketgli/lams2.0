import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { Validator } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import type { ActivityScope } from '../employees/activity';
import { COMBINES, type Combine, toCombine } from './combine';

/**
 * Leave types (the Leave Policy master, table `leave_types`). Everyone signed in reads
 * them (the apply form needs them); only administrators change them. Every change is
 * audited (master_key 'leave_type') in the same transaction. Nothing is pre-filled.
 */

export const ACCRUALS = ['yearly', 'half_yearly', 'quarterly', 'monthly', 'upfront'] as const;
export const SANDWICH = ['excluded', 'included'] as const;
export const GENDERS = ['all', 'female_only', 'male_only'] as const;
export const STAGES = [1, 2] as const;

const AUDIT_KEY = 'leave_type';

export const LEAVE_TYPE_SCOPE: ActivityScope = {
  keys: ['leave_type', 'leave_type_export'],
  areaLabels: { leave_type: 'Leave type', leave_type_export: 'Log download' },
  exportKey: 'leave_type_export',
  title: 'Leave policy activity log',
  filePrefix: 'WII_Leave_Policy_Activity',
};

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  description: string;
  defaultQuota: number;
  pwdQuota: number | null;
  pwdOnly: boolean;
  accrual: (typeof ACCRUALS)[number];
  maxAccumulation: number;
  carryForward: boolean;
  maxCarryForward: number;
  encashmentAllowed: boolean;
  approvalStages: 1 | 2;
  minNoticeDays: number;
  halfDayAllowed: boolean;
  medicalCertDays: number;
  sandwichRule: (typeof SANDWICH)[number];
  combineWith: Combine;
  employeeTypes: string[];
  gender: (typeof GENDERS)[number];
  minServiceMonths: number;
  maxConsecutiveDays: number;
  isDebited: boolean;
  isPaid: boolean;
  afterExhaustedTypeId: string;
  debitFromTypeId: string;
  debitFactor: number;
  lifetimeMax: number;
  maxSpellsPerYear: number;
  minDaysPerApplication: number;
  maxSpellsPerMonth: number;
  maxSpellsLifetime: number;
  quotas: Array<{ employeeType: string; quota: number }>;
  status: 'active' | 'inactive';
  updatedAt: string | null;
}

export type LeaveTypeInput = Omit<LeaveType, 'id' | 'updatedAt'>;

export function toLeaveType(row: RowDataPacket): LeaveType {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: row.description ? String(row.description) : '',
    defaultQuota: Number(row.default_quota),
    pwdQuota: row.pwd_quota === null || row.pwd_quota === undefined ? null : Number(row.pwd_quota),
    pwdOnly: Boolean(row.pwd_only),
    accrual: String(row.accrual) as LeaveType['accrual'],
    maxAccumulation: Number(row.max_accumulation),
    carryForward: Boolean(row.carry_forward),
    maxCarryForward: Number(row.max_carry_forward),
    encashmentAllowed: Boolean(row.encashment_allowed),
    approvalStages: Number(row.approval_stages) === 2 ? 2 : 1,
    minNoticeDays: Number(row.min_notice_days),
    halfDayAllowed: Boolean(row.half_day_allowed),
    medicalCertDays: Number(row.medical_cert_days),
    sandwichRule: String(row.sandwich_rule) === 'included' ? 'included' : 'excluded',
    combineWith: toCombine(row.combine_with),
    employeeTypes: String(row.employee_types || '').split(',').map((s) => s.trim()).filter(Boolean),
    gender: String(row.gender) as LeaveType['gender'],
    minServiceMonths: Number(row.min_service_months),
    maxConsecutiveDays: Number(row.max_consecutive_days),
    isDebited: Boolean(row.is_debited),
    isPaid: row.is_paid === undefined ? true : Boolean(row.is_paid),
    afterExhaustedTypeId: row.after_exhausted_type_id ? String(row.after_exhausted_type_id) : '',
    debitFromTypeId: row.debit_from_type_id ? String(row.debit_from_type_id) : '',
    debitFactor: Number(row.debit_factor ?? 1),
    lifetimeMax: Number(row.lifetime_max ?? 0),
    maxSpellsPerYear: Number(row.max_spells_per_year ?? 0),
    minDaysPerApplication: Number(row.min_days_per_application ?? 0),
    maxSpellsPerMonth: Number(row.max_spells_per_month ?? 0),
    maxSpellsLifetime: Number(row.max_spells_lifetime ?? 0),
    quotas: [],
    status: String(row.status) === 'inactive' ? 'inactive' : 'active',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

const auditView = (t: LeaveTypeInput): Record<string, unknown> => ({ ...t });
const label = (t: Pick<LeaveType, 'name' | 'code'>) => `${t.name} (${t.code})`;

function missingTable(error: unknown): never | void {
  const code = (error as { code?: string })?.code;
  if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') {
    throw new HttpError(503, 'Leave is not set up yet. Ask the administrator to run the leave migrations.', 'NOT_CONFIGURED');
  }
}

/** employee_type codes that exist, so an unknown code is rejected. */
async function employeeTypeCodes(): Promise<Set<string>> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT code FROM lookup_values WHERE lookup_type = 'employee_type'");
  return new Set(rows.map((r) => String(r.code)));
}

export async function parseLeaveTypeInput(body: unknown, selfId = 0): Promise<LeaveTypeInput> {
  const v = new Validator(body);
  const code = v.string('code', { min: 1, max: 20, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'Use letters, numbers, - or _ only.' }).toUpperCase();
  const name = v.string('name', { min: 2, max: 100 }).replace(/\s+/g, ' ');
  const description = v.optionalString('description', { max: 500 });
  const quota = Number(v.raw('defaultQuota'));
  if (!Number.isFinite(quota) || quota < 0 || quota > 400 || Math.round(quota * 2) !== quota * 2) v.errors.defaultQuota ||= 'Enter days from 0 to 400, in steps of 0.5.';
  const rawPwd = v.raw('pwdQuota');
  let pwdQuota: number | null = null;
  if (rawPwd !== undefined && rawPwd !== null && String(rawPwd).trim() !== '') {
    pwdQuota = Number(rawPwd);
    if (!Number.isFinite(pwdQuota) || pwdQuota < 0 || pwdQuota > 400 || Math.round(pwdQuota * 2) !== pwdQuota * 2) v.errors.pwdQuota ||= 'Enter days from 0 to 400, in steps of 0.5.';
  }
  const pwdOnly = v.bool('pwdOnly');
  const accrual = v.oneOf('accrual', ACCRUALS);
  const maxAccumulation = v.int('maxAccumulation', { min: 0, max: 1000 });
  const carryForward = v.bool('carryForward');
  const cf = Number(v.raw('maxCarryForward') ?? 0);
  if (!Number.isFinite(cf) || cf < 0 || cf > 1000 || Math.round(cf * 2) !== cf * 2) v.errors.maxCarryForward ||= 'Enter days from 0 to 1000, in steps of 0.5.';
  const encashmentAllowed = v.bool('encashmentAllowed');
  const stages = Number(v.raw('approvalStages'));
  if (!(STAGES as readonly number[]).includes(stages)) v.errors.approvalStages ||= 'Choose 1 or 2 approval stages.';
  const minNoticeDays = v.int('minNoticeDays', { min: 0, max: 365 });
  const halfDayAllowed = v.bool('halfDayAllowed');
  const medicalCertDays = v.int('medicalCertDays', { min: 0, max: 365 });
  const sandwichRule = v.oneOf('sandwichRule', SANDWICH);
  const gender = v.oneOf('gender', GENDERS);
  const combineWith = v.oneOf('combineWith', COMBINES);
  const minServiceMonths = v.int('minServiceMonths', { min: 0, max: 600 });
  const maxConsecutiveDays = v.int('maxConsecutiveDays', { min: 0, max: 730 });
  const isDebited = v.bool('isDebited', true);
  const isPaid = v.bool('isPaid', true);
  const lifetimeMax = Number(v.raw('lifetimeMax') ?? 0);
  if (!Number.isFinite(lifetimeMax) || lifetimeMax < 0 || lifetimeMax > 5000 || Math.round(lifetimeMax * 2) !== lifetimeMax * 2) v.errors.lifetimeMax ||= 'Enter days from 0 to 5000, in steps of 0.5.';
  const maxSpellsPerYear = v.int('maxSpellsPerYear', { min: 0, max: 100 });
  const minDaysPerApplication = Number(v.raw('minDaysPerApplication') ?? 0);
  if (!Number.isFinite(minDaysPerApplication) || minDaysPerApplication < 0 || minDaysPerApplication > 730 || Math.round(minDaysPerApplication * 2) !== minDaysPerApplication * 2) v.errors.minDaysPerApplication ||= 'Enter days from 0 to 730, in steps of 0.5.';
  else if (maxConsecutiveDays && maxConsecutiveDays > 0 && minDaysPerApplication > maxConsecutiveDays) v.errors.minDaysPerApplication ||= 'The minimum cannot be more than the maximum.';
  const maxSpellsPerMonth = v.int('maxSpellsPerMonth', { min: 0, max: 31 });
  const maxSpellsLifetime = v.int('maxSpellsLifetime', { min: 0, max: 1000 });
  const rawAfter = v.raw('afterExhaustedTypeId');
  const afterText = rawAfter === undefined || rawAfter === null ? '' : String(rawAfter).trim();
  let afterExhaustedTypeId = '';
  if (afterText) {
    if (!/^\d{1,20}$/.test(afterText) || Number(afterText) === selfId) v.errors.afterExhaustedTypeId ||= 'Choose another leave type from the list.';
    else {
      const [found] = await pool.query<RowDataPacket[]>('SELECT id, is_debited FROM leave_types WHERE id = ?', [Number(afterText)]);
      if (!found[0] || !found[0].is_debited) v.errors.afterExhaustedTypeId ||= 'Choose a leave type that has a balance.';
      else afterExhaustedTypeId = afterText;
    }
  }
  const status = v.oneOf('status', ['active', 'inactive'] as const);
  const rawTypes = v.raw('employeeTypes');
  let employeeTypes: string[] = [];
  if (rawTypes !== undefined && !Array.isArray(rawTypes)) v.errors.employeeTypes ||= 'Choose employee types from the list.';
  else if (Array.isArray(rawTypes)) {
    employeeTypes = [...new Set(rawTypes.map((t) => String(t).trim()).filter(Boolean))];
    const known = await employeeTypeCodes();
    if (employeeTypes.some((t) => !known.has(t))) v.errors.employeeTypes ||= 'Choose employee types from the list.';
  }
  const quotas: LeaveTypeInput['quotas'] = [];
  const rawQuotas = v.raw('quotas');
  if (rawQuotas !== undefined && !Array.isArray(rawQuotas)) v.errors.quotas ||= 'Enter the quota for each employee type.';
  else if (Array.isArray(rawQuotas) && rawQuotas.length) {
    const known = await employeeTypeCodes();
    const seen = new Set<string>();
    for (const item of rawQuotas) {
      const employeeType = String((item as { employeeType?: unknown })?.employeeType ?? '').trim();
      const q = Number((item as { quota?: unknown })?.quota);
      if (!known.has(employeeType) || seen.has(employeeType) || (employeeTypes.length && !employeeTypes.includes(employeeType))) { v.errors.quotas ||= 'Choose each employee type once, from the allowed types.'; break; }
      if (!Number.isFinite(q) || q < 0 || q > 400 || Math.round(q * 2) !== q * 2) { v.errors.quotas ||= 'Enter quota days from 0 to 400, in steps of 0.5.'; break; }
      if (maxAccumulation && q > maxAccumulation) { v.errors.quotas ||= 'A quota cannot be more than the maximum balance.'; break; }
      seen.add(employeeType);
      quotas.push({ employeeType, quota: q });
    }
  }
  const rawDebit = v.raw('debitFromTypeId');
  const debitText = rawDebit === undefined || rawDebit === null ? '' : String(rawDebit).trim();
  let debitFromTypeId = '';
  const debitFactor = Number(v.raw('debitFactor') ?? 1);
  if (!Number.isFinite(debitFactor) || debitFactor < 0.5 || debitFactor > 10 || Math.round(debitFactor * 2) !== debitFactor * 2) v.errors.debitFactor ||= 'Enter days from 0.5 to 10, in steps of 0.5.';
  if (debitText) {
    if (!/^\d{1,20}$/.test(debitText) || Number(debitText) === selfId) v.errors.debitFromTypeId ||= 'Choose another leave type from the list.';
    else {
      const [found] = await pool.query<RowDataPacket[]>('SELECT id, is_debited FROM leave_types WHERE id = ?', [Number(debitText)]);
      if (!found[0] || !found[0].is_debited) v.errors.debitFromTypeId ||= 'Choose a leave type that has a balance.';
      else debitFromTypeId = debitText;
    }
    if (isDebited) v.errors.isDebited ||= 'A leave type that uses another leave type’s balance has no balance of its own.';
  }
  if (carryForward && cf <= 0) v.errors.maxCarryForward ||= 'Enter how many days can be carried forward.';
  if (maxAccumulation && pwdQuota !== null && pwdQuota > maxAccumulation) v.errors.pwdQuota ||= 'Cannot be more than the maximum balance.';
  if (maxAccumulation && quota > maxAccumulation) v.errors.maxAccumulation ||= 'Cannot be less than the yearly quota.';
  v.assert();
  return {
    code, name, description: description ?? '', defaultQuota: quota, pwdQuota, pwdOnly, accrual: accrual!, maxAccumulation: maxAccumulation!, carryForward,
    maxCarryForward: carryForward ? cf : 0, encashmentAllowed, approvalStages: stages as 1 | 2, minNoticeDays: minNoticeDays!, halfDayAllowed,
    medicalCertDays: medicalCertDays!, sandwichRule: sandwichRule!, combineWith: combineWith!, employeeTypes, gender: gender!, minServiceMonths: minServiceMonths!,
    maxConsecutiveDays: maxConsecutiveDays!, isDebited, isPaid, afterExhaustedTypeId, debitFromTypeId, debitFactor, lifetimeMax, maxSpellsPerYear: maxSpellsPerYear!, minDaysPerApplication, maxSpellsPerMonth: maxSpellsPerMonth!, maxSpellsLifetime: maxSpellsLifetime!, quotas, status: status!,
  };
}

export async function listLeaveTypes(): Promise<LeaveType[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM leave_types ORDER BY name');
    return await withQuotas(pool, rows.map(toLeaveType));
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

type Q = { query: typeof pool.query };

async function withQuotas(q: Q, types: LeaveType[]): Promise<LeaveType[]> {
  if (!types.length) return types;
  const [rows] = await q.query<RowDataPacket[]>('SELECT leave_type_id, employee_type, quota FROM leave_type_quotas ORDER BY employee_type');
  for (const t of types) t.quotas = rows.filter((r) => String(r.leave_type_id) === t.id).map((r) => ({ employeeType: String(r.employee_type), quota: Number(r.quota) }));
  return types;
}

async function saveQuotas(conn: Q, id: number, quotas: LeaveTypeInput['quotas']): Promise<void> {
  await conn.query('DELETE FROM leave_type_quotas WHERE leave_type_id = ?', [id]);
  for (const q of quotas) await conn.query('INSERT INTO leave_type_quotas (leave_type_id, employee_type, quota) VALUES (?, ?, ?)', [id, q.employeeType, q.quota]);
}

export async function leaveTypeOptions(): Promise<{ employeeTypes: Array<{ code: string; name: string }> }> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT code, name FROM lookup_values WHERE lookup_type = 'employee_type' AND status = 'active' ORDER BY name");
  return { employeeTypes: rows.map((r) => ({ code: String(r.code), name: String(r.name) })) };
}

const COLS = `code, name, description, default_quota, pwd_quota, accrual, max_accumulation, carry_forward, max_carry_forward, encashment_allowed, approval_stages,
  min_notice_days, half_day_allowed, medical_cert_days, sandwich_rule, combine_with, employee_types, pwd_only, gender, min_service_months, max_consecutive_days,
  is_debited, is_paid, after_exhausted_type_id, debit_from_type_id, debit_factor, lifetime_max, max_spells_per_year, min_days_per_application, max_spells_per_month, max_spells_lifetime, status`;
const values = (t: LeaveTypeInput) => [
  t.code, t.name, t.description || null, t.defaultQuota, t.pwdQuota, t.accrual, t.maxAccumulation, t.carryForward ? 1 : 0, t.maxCarryForward, t.encashmentAllowed ? 1 : 0,
  t.approvalStages, t.minNoticeDays, t.halfDayAllowed ? 1 : 0, t.medicalCertDays, t.sandwichRule, t.combineWith, t.employeeTypes.join(','), t.pwdOnly ? 1 : 0, t.gender, t.minServiceMonths,
  t.maxConsecutiveDays, t.isDebited ? 1 : 0, t.isPaid ? 1 : 0, t.afterExhaustedTypeId ? Number(t.afterExhaustedTypeId) : null, t.debitFromTypeId ? Number(t.debitFromTypeId) : null, t.debitFactor, t.lifetimeMax, t.maxSpellsPerYear, t.minDaysPerApplication, t.maxSpellsPerMonth, t.maxSpellsLifetime, t.status,
];

function duplicate(error: unknown): never | void {
  if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
    const msg = String((error as { sqlMessage?: string }).sqlMessage ?? '');
    const field = msg.includes('uq_leave_types_name') ? 'name' : 'code';
    throw new HttpError(409, 'A leave type with this ' + field + ' already exists.', 'DUPLICATE', { [field]: `This ${field} is already used by another leave type.` });
  }
}

export async function createLeaveType(req: Request, body: unknown): Promise<LeaveType> {
  const input = await parseLeaveTypeInput(body);
  try {
    return await inTransaction(async (conn) => {
      const [result] = await conn.query(`INSERT INTO leave_types (${COLS}) VALUES (${COLS.split(',').map(() => '?').join(',')})`, values(input));
      const id = Number((result as { insertId: number }).insertId);
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM leave_types WHERE id = ?', [id]);
      await saveQuotas(conn, id, input.quotas);
      const [created] = await withQuotas(conn, [toLeaveType(rows[0])]);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(created), action: 'CREATE', after: auditView(input), reason: reasonOf(body) });
      return created;
    });
  } catch (error) {
    missingTable(error);
    duplicate(error);
    throw error;
  }
}

const reasonOf = (body: unknown) => {
  const r = (body as { reason?: unknown })?.reason;
  return typeof r === 'string' && r.trim() ? r.trim().slice(0, 500) : null;
};

/** Number of balances / requests that use this leave type (0 while those tables do not exist yet). */
export async function leaveTypeUsage(conn: { query: typeof pool.query }, id: number): Promise<number> {
  let total = 0;
  for (const table of ['leave_balances', 'leave_requests']) {
    try {
      const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${table} WHERE leave_type_id = ?`, [id]);
      total += Number(rows[0]?.n ?? 0);
    } catch (error) {
      if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
  }
  return total;
}

export async function updateLeaveType(req: Request, id: number, body: unknown): Promise<LeaveType> {
  const input = await parseLeaveTypeInput(body, id);
  try {
    return await inTransaction(async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM leave_types WHERE id = ? FOR UPDATE', [id]);
      if (!rows[0]) throw notFound('Leave type not found.');
      const [before] = await withQuotas(conn, [toLeaveType(rows[0])]);
      if (before.code !== input.code && (await leaveTypeUsage(conn, id)) > 0) {
        throw new HttpError(409, 'This leave type is already used by balances or requests, so its code cannot change.', 'IN_USE', { code: 'The code cannot change once the leave type is in use.' });
      }
      const sets = COLS.split(',').map((c) => `${c.trim()} = ?`).join(', ');
      await conn.query(`UPDATE leave_types SET ${sets} WHERE id = ?`, [...values(input), id]);
      await saveQuotas(conn, id, input.quotas);
      const [after] = await conn.query<RowDataPacket[]>('SELECT * FROM leave_types WHERE id = ?', [id]);
      const [updated] = await withQuotas(conn, [toLeaveType(after[0])]);
      const beforeView = auditView(before as unknown as LeaveTypeInput);
      const afterView = auditView(input);
      delete beforeView.id; delete beforeView.updatedAt;
      const fields = changedFields(beforeView, afterView);
      if (fields.length) {
        await writeMasterAuditSql(conn, req, {
          masterKey: AUDIT_KEY, recordId: id, recordLabel: label(updated), action: before.status !== updated.status ? 'STATUS' : 'UPDATE',
          before: beforeView, after: afterView, reason: reasonOf(body),
        });
      }
      return updated;
    });
  } catch (error) {
    missingTable(error);
    duplicate(error);
    throw error;
  }
}

export async function deleteLeaveType(req: Request, id: number, reason: string | null): Promise<void> {
  try {
    await inTransaction(async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM leave_types WHERE id = ? FOR UPDATE', [id]);
      if (!rows[0]) throw notFound('Leave type not found.');
      const [before] = await withQuotas(conn, [toLeaveType(rows[0])]);
      if ((await leaveTypeUsage(conn, id)) > 0) {
        throw new HttpError(409, 'This leave type is used by balances or requests. Make it Inactive instead of deleting it.', 'IN_USE');
      }
      try {
        const [grouped] = await conn.query<RowDataPacket[]>('SELECT g.name FROM leave_group_types t JOIN leave_groups g ON g.id = t.group_id WHERE t.leave_type_id = ? LIMIT 1', [id]);
        if (grouped[0]) throw new HttpError(409, `This leave type is part of the leave group “${grouped[0].name}”. Remove it from the group first.`, 'IN_USE');
      } catch (error) {
        if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
      }
      const [linked] = await conn.query<RowDataPacket[]>('SELECT name FROM leave_types WHERE after_exhausted_type_id = ? OR debit_from_type_id = ? LIMIT 1', [id, id]);
      if (linked[0]) throw new HttpError(409, `“${linked[0].name}” depends on this leave type. Change it first.`, 'IN_USE');
      await conn.query('DELETE FROM leave_type_quotas WHERE leave_type_id = ?', [id]);
      await conn.query('DELETE FROM leave_types WHERE id = ?', [id]);
      const view = auditView(before as unknown as LeaveTypeInput);
      delete view.id; delete view.updatedAt;
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(before), action: 'DELETE', before: view, reason });
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export function leaveTypeId(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw badRequest('Invalid record ID.');
  return id;
}
