import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { Validator } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import type { ActivityScope } from '../employees/activity';
import { ACCRUALS } from './types';

/**
 * Leave policies (tables leave_policies and leave_policy_items): one policy per employee
 * category and version. A policy holds its leave types (each with its own entitlement and
 * conditions), the general leave rules, the approval workflow and who it is assigned to.
 *
 *   draft     editable, deletable
 *   active    locked; changes are made as a NEW VERSION (copy, then edit, then activate)
 *   inactive  locked; can be made active again
 *
 * Activating a policy ends the earlier active version of the same policy the day before it
 * starts, and is refused if another active policy of the same category overlaps. Active policies
 * are never deleted. Only administrators change them; every change is audited
 * (master_key 'leave_policy') in the same transaction. Leave balances and requests are not touched.
 */

export const YEAR_CYCLES = ['calendar', 'financial'] as const;
export const POLICY_STATUSES = ['draft', 'active', 'inactive'] as const;
export const MID_YEAR = ['prorata', 'full', 'none'] as const;
export const ALLOW = ['allowed', 'not_allowed'] as const;
export const COUNTED = ['included', 'excluded'] as const;
export const SEPARATION = ['lapse', 'encash', 'adjust'] as const;
export const APPROVAL_MODES = ['single_level', 'two_level'] as const;
export const WORKFLOW = ['enabled', 'disabled'] as const;
export const APPROVER_ROLES = ['reporting_manager', 'reviewing_manager', 'administrator'] as const;
export const ASSIGNMENT = ['automatic', 'manual', 'default_override'] as const;
export const SCOPES = ['all', 'selected'] as const;

const AUDIT_KEY = 'leave_policy';

export const LEAVE_POLICY_SCOPE: ActivityScope = {
  keys: [AUDIT_KEY, 'leave_policy_export'],
  areaLabels: { leave_policy: 'Leave policy', leave_policy_export: 'Log download' },
  exportKey: 'leave_policy_export',
  title: 'Leave policy activity log',
  filePrefix: 'WII_Leave_Policy_Activity',
};

export interface PolicyItem {
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  annualEntitlement: number;
  accrual: (typeof ACCRUALS)[number];
  accrualQuantity: number;
  maxBalance: number;
  minApplication: number;
  maxApplication: number;
  carryForward: boolean;
  carryLimit: number;
  encashment: boolean;
  encashLimit: number;
  halfDay: boolean;
  documentRequired: boolean;
  probationApplicable: boolean;
  negativeBalance: boolean;
  conditions: string;
}

export interface PolicyInput {
  code: string;
  name: string;
  employeeCategory: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
  yearCycle: (typeof YEAR_CYCLES)[number];
  status: 'draft' | 'active';
  description: string;
  items: Array<Omit<PolicyItem, 'leaveTypeName' | 'leaveTypeCode'>>;
  proRata: boolean;
  midYearJoining: (typeof MID_YEAR)[number];
  backdatedLeave: (typeof ALLOW)[number];
  noticePeriodLeave: (typeof ALLOW)[number];
  sandwichRule: (typeof COUNTED)[number];
  weeklyOff: (typeof COUNTED)[number];
  publicHoliday: (typeof COUNTED)[number];
  separationBalance: (typeof SEPARATION)[number];
  generalRemarks: string;
  approvalMode: (typeof APPROVAL_MODES)[number];
  workflowStatus: (typeof WORKFLOW)[number];
  l1Role: string;
  l1Mandatory: boolean;
  l2Role: string;
  l2Mandatory: boolean;
  assignmentMethod: (typeof ASSIGNMENT)[number];
  departmentScope: (typeof SCOPES)[number];
  departments: string[];
  designationScope: (typeof SCOPES)[number];
  designations: string[];
  assignmentRemarks: string;
  referenceNo: string;
  orderDate: string;
  officialRemarks: string;
}

export interface Policy extends Omit<PolicyInput, 'status' | 'items'> {
  id: string;
  status: (typeof POLICY_STATUSES)[number];
  items: PolicyItem[];
  /** True while the policy can still be edited or deleted (drafts only). */
  editable: boolean;
  updatedAt: string | null;
}

const POLICY_COLS = `id, code, name, employee_category, version, DATE_FORMAT(effective_from, '%Y-%m-%d') AS effective_from, DATE_FORMAT(effective_to, '%Y-%m-%d') AS effective_to,
  year_cycle, status, description, pro_rata, mid_year_joining, backdated_leave, notice_period_leave, sandwich_rule, weekly_off, public_holiday, separation_balance,
  general_remarks, approval_mode, workflow_status, l1_role, l1_mandatory, l2_role, l2_mandatory, assignment_method, department_scope, departments, designation_scope,
  designations, assignment_remarks, reference_no, DATE_FORMAT(order_date, '%Y-%m-%d') AS order_date, official_remarks, updated_at`;

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const list = (v: unknown): string[] => {
  try {
    const parsed = JSON.parse(text(v) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

function toItem(row: RowDataPacket): PolicyItem {
  return {
    leaveTypeId: String(row.leave_type_id), leaveTypeName: text(row.type_name), leaveTypeCode: text(row.type_code),
    annualEntitlement: Number(row.annual_entitlement), accrual: text(row.accrual) as PolicyItem['accrual'], accrualQuantity: Number(row.accrual_quantity),
    maxBalance: Number(row.max_balance), minApplication: Number(row.min_application), maxApplication: Number(row.max_application),
    carryForward: Boolean(row.carry_forward), carryLimit: Number(row.carry_limit), encashment: Boolean(row.encashment), encashLimit: Number(row.encash_limit),
    halfDay: Boolean(row.half_day), documentRequired: Boolean(row.document_required), probationApplicable: Boolean(row.probation_applicable),
    negativeBalance: Boolean(row.negative_balance), conditions: text(row.conditions),
  };
}

function toPolicy(row: RowDataPacket, items: PolicyItem[]): Policy {
  const status = text(row.status) as Policy['status'];
  return {
    id: String(row.id), code: text(row.code), name: text(row.name), employeeCategory: text(row.employee_category), version: text(row.version),
    effectiveFrom: text(row.effective_from), effectiveTo: text(row.effective_to), yearCycle: text(row.year_cycle) as Policy['yearCycle'], status,
    description: text(row.description), items,
    proRata: Boolean(row.pro_rata), midYearJoining: text(row.mid_year_joining) as Policy['midYearJoining'], backdatedLeave: text(row.backdated_leave) as Policy['backdatedLeave'],
    noticePeriodLeave: text(row.notice_period_leave) as Policy['noticePeriodLeave'], sandwichRule: text(row.sandwich_rule) as Policy['sandwichRule'],
    weeklyOff: text(row.weekly_off) as Policy['weeklyOff'], publicHoliday: text(row.public_holiday) as Policy['publicHoliday'],
    separationBalance: text(row.separation_balance) as Policy['separationBalance'], generalRemarks: text(row.general_remarks),
    approvalMode: text(row.approval_mode) as Policy['approvalMode'], workflowStatus: text(row.workflow_status) as Policy['workflowStatus'],
    l1Role: text(row.l1_role), l1Mandatory: Boolean(row.l1_mandatory), l2Role: text(row.l2_role), l2Mandatory: Boolean(row.l2_mandatory),
    assignmentMethod: text(row.assignment_method) as Policy['assignmentMethod'], departmentScope: text(row.department_scope) as Policy['departmentScope'],
    departments: list(row.departments), designationScope: text(row.designation_scope) as Policy['designationScope'], designations: list(row.designations),
    assignmentRemarks: text(row.assignment_remarks), referenceNo: text(row.reference_no), orderDate: text(row.order_date), officialRemarks: text(row.official_remarks),
    editable: status === 'draft',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

type Q = { query: typeof pool.query };

function missingTable(error: unknown): never | void {
  const code = (error as { code?: string })?.code;
  if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') {
    throw new HttpError(503, 'Leave policies are not set up yet. Ask the administrator to run the leave policy migration.', 'NOT_CONFIGURED');
  }
}

const label = (p: Pick<Policy, 'name' | 'version'>) => `${p.name} v${p.version}`;
const reasonOf = (body: unknown) => {
  const r = (body as { reason?: unknown })?.reason;
  return typeof r === 'string' && r.trim() ? r.trim().slice(0, 500) : null;
};

async function loadItems(q: Q, ids: number[]): Promise<Map<number, PolicyItem[]>> {
  const out = new Map<number, PolicyItem[]>();
  if (!ids.length) return out;
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT i.*, t.name AS type_name, t.code AS type_code FROM leave_policy_items i JOIN leave_types t ON t.id = i.leave_type_id
     WHERE i.policy_id IN (${ids.map(() => '?').join(',')}) ORDER BY i.sort_order, i.id`, ids);
  for (const r of rows) {
    const key = Number(r.policy_id);
    out.set(key, [...(out.get(key) ?? []), toItem(r)]);
  }
  return out;
}

async function loadPolicies(q: Q, where = '', params: unknown[] = []): Promise<Policy[]> {
  const [rows] = await q.query<RowDataPacket[]>(`SELECT ${POLICY_COLS} FROM leave_policies ${where} ORDER BY name, code, effective_from DESC`, params);
  const items = await loadItems(q, rows.map((r) => Number(r.id)));
  return rows.map((r) => toPolicy(r, items.get(Number(r.id)) ?? []));
}

export async function listPolicies(): Promise<Policy[]> {
  try {
    return await loadPolicies(pool);
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export interface PolicyOptions {
  employeeTypes: Array<{ code: string; name: string }>;
  leaveTypes: Array<{ id: string; code: string; name: string }>;
  departments: string[];
  designations: string[];
  roles: Array<{ id: string; label: string }>;
}

const ROLE_NAMES: Record<(typeof APPROVER_ROLES)[number], string> = { reporting_manager: 'Reporting Manager', reviewing_manager: 'HoD (Reviewing Manager)', administrator: 'Administrator' };

export async function policyOptions(): Promise<PolicyOptions> {
  const [types] = await pool.query<RowDataPacket[]>("SELECT code, name FROM lookup_values WHERE lookup_type = 'employee_type' AND UPPER(status) = 'ACTIVE' ORDER BY name");
  const [leave] = await pool.query<RowDataPacket[]>("SELECT id, code, name FROM leave_types WHERE status = 'active' ORDER BY name");
  const [units] = await pool.query<RowDataPacket[]>("SELECT name FROM organization_units WHERE UPPER(status) = 'ACTIVE' ORDER BY name");
  const [desig] = await pool.query<RowDataPacket[]>("SELECT name FROM designations WHERE UPPER(status) = 'ACTIVE' ORDER BY name");
  return {
    employeeTypes: types.map((r) => ({ code: text(r.code), name: text(r.name) })),
    leaveTypes: leave.map((r) => ({ id: String(r.id), code: text(r.code), name: text(r.name) })),
    departments: units.map((r) => text(r.name)),
    designations: desig.map((r) => text(r.name)),
    roles: APPROVER_ROLES.map((id) => ({ id, label: ROLE_NAMES[id] })),
  };
}

// ---- Validation -------------------------------------------------------------------------------

/** Days in steps of half a day. */
const halfDays = (n: number, max: number) => Number.isFinite(n) && n >= 0 && n <= max && Math.round(n * 2) === n * 2;

type Errors = Record<string, string>;

function parseItems(raw: unknown, errors: Errors, leaveTypes: Set<string>): PolicyInput['items'] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.items = 'Add leave types as a list.';
    return [];
  }
  const out: PolicyInput['items'] = [];
  const seen = new Set<string>();
  raw.forEach((entry, i) => {
    const at = (field: string, message: string) => { errors[`items.${i}.${field}`] ||= message; };
    const e = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const leaveTypeId = text(e.leaveTypeId).trim();
    if (!leaveTypeId) at('leaveTypeId', 'Choose a leave type.');
    else if (!leaveTypes.has(leaveTypeId)) at('leaveTypeId', 'Choose an active leave type from the list.');
    else if (seen.has(leaveTypeId)) at('leaveTypeId', 'This leave type is already added to the policy.');
    seen.add(leaveTypeId);
    const num = (field: string, max: number, message: string): number => {
      const raw = e[field];
      const n = raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
      if (!halfDays(n, max)) { at(field, message); return 0; }
      return n;
    };
    const annualEntitlement = num('annualEntitlement', 400, 'Enter days from 0 to 400, in steps of 0.5.');
    if (e.annualEntitlement === undefined || e.annualEntitlement === null || e.annualEntitlement === '') at('annualEntitlement', 'This field is required.');
    const accrual = ACCRUALS.find((a) => a === e.accrual);
    if (!accrual) at('accrual', 'Choose how the leave is credited.');
    const accrualQuantity = num('accrualQuantity', 400, 'Enter days from 0 to 400, in steps of 0.5.');
    const maxBalance = num('maxBalance', 1000, 'Enter days from 0 to 1000, in steps of 0.5.');
    const minApplication = num('minApplication', 365, 'Enter days from 0 to 365, in steps of 0.5.');
    const maxApplication = num('maxApplication', 730, 'Enter days from 0 to 730, in steps of 0.5.');
    const flag = (field: string, fallback: boolean): boolean => {
      const v = e[field];
      if (v === undefined || v === null) return fallback;
      if (typeof v === 'boolean') return v;
      at(field, 'Choose Yes or No.');
      return fallback;
    };
    const carryForward = flag('carryForward', false);
    const carryLimit = num('carryLimit', 1000, 'Enter days from 0 to 1000, in steps of 0.5.');
    const encashment = flag('encashment', false);
    const encashLimit = num('encashLimit', 1000, 'Enter days from 0 to 1000, in steps of 0.5.');
    const conditions = text(e.conditions).trim();
    if (conditions.length > 500) at('conditions', 'Must be at most 500 characters.');
    if (maxBalance && annualEntitlement > maxBalance) at('maxBalance', 'Cannot be less than the annual entitlement.');
    if (maxBalance && carryForward && carryLimit > maxBalance) at('carryLimit', 'Cannot be more than the maximum balance.');
    if (minApplication && maxApplication && minApplication > maxApplication) at('maxApplication', 'Cannot be less than the minimum application.');
    if (accrual && accrual !== 'yearly' && accrual !== 'upfront' && accrualQuantity <= 0) at('accrualQuantity', 'Enter how many days are credited each time.');
    if (carryForward && carryLimit <= 0) at('carryLimit', 'Enter how many days can be carried forward.');
    if (encashment && encashLimit <= 0) at('encashLimit', 'Enter how many days can be encashed.');
    out.push({
      leaveTypeId, annualEntitlement, accrual: accrual ?? 'yearly', accrualQuantity, maxBalance, minApplication, maxApplication,
      carryForward, carryLimit: carryForward ? carryLimit : 0, encashment, encashLimit: encashment ? encashLimit : 0,
      halfDay: flag('halfDay', false), documentRequired: flag('documentRequired', false), probationApplicable: flag('probationApplicable', true),
      negativeBalance: flag('negativeBalance', false), conditions,
    });
  });
  return out;
}

async function names(sql: string): Promise<Set<string>> {
  const [rows] = await pool.query<RowDataPacket[]>(sql);
  return new Set(rows.map((r) => text(r.name)));
}

export async function parsePolicyInput(body: unknown): Promise<PolicyInput> {
  const v = new Validator(body);
  const code = v.string('code', { min: 2, max: 30, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'Use letters, numbers, - or _ only.' }).toUpperCase();
  const name = v.string('name', { min: 2, max: 150 }).replace(/\s+/g, ' ');
  const employeeCategory = v.string('employeeCategory', { max: 100 });
  const version = v.string('version', { required: false, max: 20, pattern: /^[A-Za-z0-9._-]+$/, patternMessage: 'Use letters, numbers, . - or _ only.' }) || '1.0';
  const effectiveFrom = v.date('effectiveFrom') ?? '';
  const effectiveTo = v.date('effectiveTo', false) ?? '';
  const yearCycle = v.oneOf('yearCycle', YEAR_CYCLES);
  const status = v.oneOf('status', ['draft', 'active'] as const, false) ?? 'draft';
  const description = v.optionalString('description', { max: 1000 }) ?? '';
  const proRata = v.bool('proRata');
  const midYearJoining = v.oneOf('midYearJoining', MID_YEAR);
  const backdatedLeave = v.oneOf('backdatedLeave', ALLOW);
  const noticePeriodLeave = v.oneOf('noticePeriodLeave', ALLOW);
  const sandwichRule = v.oneOf('sandwichRule', COUNTED);
  const weeklyOff = v.oneOf('weeklyOff', COUNTED);
  const publicHoliday = v.oneOf('publicHoliday', COUNTED);
  const separationBalance = v.oneOf('separationBalance', SEPARATION);
  const generalRemarks = v.optionalString('generalRemarks', { max: 1000 }) ?? '';
  const approvalMode = v.oneOf('approvalMode', APPROVAL_MODES);
  const workflowStatus = v.oneOf('workflowStatus', WORKFLOW);
  const l1Role = v.oneOf('l1Role', APPROVER_ROLES, workflowStatus === 'enabled') ?? '';
  const l1Mandatory = v.bool('l1Mandatory', true);
  const twoLevel = workflowStatus === 'enabled' && approvalMode === 'two_level';
  const l2Role = v.oneOf('l2Role', APPROVER_ROLES, twoLevel) ?? '';
  const l2Mandatory = v.bool('l2Mandatory', true);
  const assignmentMethod = v.oneOf('assignmentMethod', ASSIGNMENT);
  const departmentScope = v.oneOf('departmentScope', SCOPES);
  const designationScope = v.oneOf('designationScope', SCOPES);
  const assignmentRemarks = v.optionalString('assignmentRemarks', { max: 1000 }) ?? '';
  const referenceNo = v.optionalString('referenceNo', { max: 100 }) ?? '';
  const orderDate = v.date('orderDate', false) ?? '';
  const officialRemarks = v.optionalString('officialRemarks', { max: 1000 }) ?? '';
  const errors = v.errors;

  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) errors.effectiveTo ||= 'Cannot be before the start date.';
  if (workflowStatus === 'enabled' && twoLevel && l1Role && l1Role === l2Role) errors.l2Role ||= 'Choose a different role for the second level.';

  const [types, leave, units, desig] = await Promise.all([
    pool.query<RowDataPacket[]>("SELECT code FROM lookup_values WHERE lookup_type = 'employee_type' AND UPPER(status) = 'ACTIVE'"),
    pool.query<RowDataPacket[]>("SELECT id FROM leave_types WHERE status = 'active'"),
    names("SELECT name FROM organization_units WHERE UPPER(status) = 'ACTIVE'"),
    names("SELECT name FROM designations WHERE UPPER(status) = 'ACTIVE'"),
  ]);
  if (employeeCategory && !types[0].some((r) => text(r.code) === employeeCategory)) errors.employeeCategory ||= 'Choose an employee category from the list.';
  const items = parseItems(v.raw('items'), errors, new Set(leave[0].map((r) => String(r.id))));

  const scoped = (field: 'departments' | 'designations', scope: string | null, known: Set<string>): string[] => {
    const raw = v.raw(field);
    if (raw !== undefined && !Array.isArray(raw)) { errors[field] ||= 'Choose from the list.'; return []; }
    const chosen = [...new Set((Array.isArray(raw) ? raw : []).map((x) => text(x).trim()).filter(Boolean))];
    if (scope === 'selected' && chosen.length === 0) errors[field] ||= 'Choose at least one, or switch to all.';
    if (chosen.some((x) => !known.has(x))) errors[field] ||= 'Choose from the list.';
    return scope === 'selected' ? chosen : [];
  };
  const departments = scoped('departments', departmentScope, units);
  const designations = scoped('designations', designationScope, desig);

  if (status === 'active' && items.length === 0) errors.items ||= 'Add at least one leave type before activating the policy.';
  v.assert();
  return {
    code, name, employeeCategory, version, effectiveFrom, effectiveTo, yearCycle: yearCycle!, status, description, items, proRata,
    midYearJoining: midYearJoining!, backdatedLeave: backdatedLeave!, noticePeriodLeave: noticePeriodLeave!, sandwichRule: sandwichRule!, weeklyOff: weeklyOff!,
    publicHoliday: publicHoliday!, separationBalance: separationBalance!, generalRemarks, approvalMode: approvalMode!, workflowStatus: workflowStatus!,
    l1Role, l1Mandatory, l2Role: twoLevel ? l2Role : '', l2Mandatory: twoLevel ? l2Mandatory : true, assignmentMethod: assignmentMethod!,
    departmentScope: departmentScope!, departments, designationScope: designationScope!, designations, assignmentRemarks, referenceNo, orderDate, officialRemarks,
  };
}

// ---- Saving -----------------------------------------------------------------------------------

const POLICY_WRITE = `code, name, employee_category, version, effective_from, effective_to, year_cycle, status, description, pro_rata, mid_year_joining, backdated_leave,
  notice_period_leave, sandwich_rule, weekly_off, public_holiday, separation_balance, general_remarks, approval_mode, workflow_status, l1_role, l1_mandatory, l2_role,
  l2_mandatory, assignment_method, department_scope, departments, designation_scope, designations, assignment_remarks, reference_no, order_date, official_remarks`;

const policyValues = (p: PolicyInput, status: string) => [
  p.code, p.name, p.employeeCategory, p.version, p.effectiveFrom, p.effectiveTo || null, p.yearCycle, status, p.description || null, p.proRata ? 1 : 0, p.midYearJoining,
  p.backdatedLeave, p.noticePeriodLeave, p.sandwichRule, p.weeklyOff, p.publicHoliday, p.separationBalance, p.generalRemarks || null, p.approvalMode, p.workflowStatus,
  p.l1Role || null, p.l1Mandatory ? 1 : 0, p.l2Role || null, p.l2Mandatory ? 1 : 0, p.assignmentMethod, p.departmentScope, JSON.stringify(p.departments),
  p.designationScope, JSON.stringify(p.designations), p.assignmentRemarks || null, p.referenceNo || null, p.orderDate || null, p.officialRemarks || null,
];

async function saveItems(conn: Q, policyId: number, items: PolicyInput['items']): Promise<void> {
  await conn.query('DELETE FROM leave_policy_items WHERE policy_id = ?', [policyId]);
  let order = 0;
  for (const i of items) {
    await conn.query(
      `INSERT INTO leave_policy_items (policy_id, leave_type_id, annual_entitlement, accrual, accrual_quantity, max_balance, min_application, max_application, carry_forward,
        carry_limit, encashment, encash_limit, half_day, document_required, probation_applicable, negative_balance, conditions, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [policyId, Number(i.leaveTypeId), i.annualEntitlement, i.accrual, i.accrualQuantity, i.maxBalance, i.minApplication, i.maxApplication, i.carryForward ? 1 : 0,
        i.carryLimit, i.encashment ? 1 : 0, i.encashLimit, i.halfDay ? 1 : 0, i.documentRequired ? 1 : 0, i.probationApplicable ? 1 : 0, i.negativeBalance ? 1 : 0,
        i.conditions || null, order++]);
  }
}

const auditView = (p: PolicyInput | Policy): Record<string, unknown> => {
  const view: Record<string, unknown> = { ...p };
  delete view.id; delete view.updatedAt; delete view.editable;
  view.items = (p.items as Array<Record<string, unknown>>).map((i) => {
    const { leaveTypeName, leaveTypeCode, ...rest } = i;
    return { ...rest, leaveType: leaveTypeCode ?? rest.leaveTypeId };
  });
  return view;
};

function duplicate(error: unknown): never | void {
  if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
    throw new HttpError(409, 'A policy with this code and version already exists.', 'DUPLICATE', { version: 'This code already has a policy with this version.' });
  }
}

/** Overlap of two periods; an empty end means "no end date". */
const overlaps = (aFrom: string, aTo: string, bFrom: string, bTo: string) => (!aTo || aTo >= bFrom) && (!bTo || bTo >= aFrom);
const dayBefore = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Makes `policy` active: ends the earlier active version of the same policy the day before this one
 * starts, and refuses if another active policy of the same category overlaps. Returns the versions it ended.
 */
async function activate(conn: Q, req: Request, policy: Pick<Policy, 'id' | 'code' | 'name' | 'version' | 'employeeCategory' | 'effectiveFrom' | 'effectiveTo'>): Promise<void> {
  const others = await loadPolicies(conn, "WHERE status = 'active' AND employee_category = ? AND id <> ?", [policy.employeeCategory, Number(policy.id)]);
  for (const o of others) {
    if (!overlaps(policy.effectiveFrom, policy.effectiveTo, o.effectiveFrom, o.effectiveTo)) continue;
    if (o.code === policy.code && o.effectiveFrom < policy.effectiveFrom) {
      await conn.query('UPDATE leave_policies SET effective_to = ? WHERE id = ?', [dayBefore(policy.effectiveFrom), Number(o.id)]);
      await writeMasterAuditSql(conn as never, req, {
        masterKey: AUDIT_KEY, recordId: Number(o.id), recordLabel: label(o), action: 'UPDATE',
        before: { effectiveTo: o.effectiveTo }, after: { effectiveTo: dayBefore(policy.effectiveFrom) }, reason: `Replaced by version ${policy.version}`,
      });
      continue;
    }
    throw new HttpError(409, `"${label(o)}" is already active for this employee category in the same period. Change the dates, or make that policy inactive first.`, 'OVERLAP', { effectiveFrom: 'Overlaps another active policy of this category.' });
  }
}

export async function createPolicy(req: Request, body: unknown): Promise<Policy> {
  const input = await parsePolicyInput(body);
  try {
    return await inTransaction(async (conn) => {
      const [result] = await conn.query(`INSERT INTO leave_policies (${POLICY_WRITE}, created_by) VALUES (${POLICY_WRITE.split(',').map(() => '?').join(',')}, ?)`,
        [...policyValues(input, 'draft'), req.auth?.account.id ?? null]);
      const id = Number((result as { insertId: number }).insertId);
      await saveItems(conn, id, input.items);
      if (input.status === 'active') {
        await activate(conn, req, { id: String(id), code: input.code, name: input.name, version: input.version, employeeCategory: input.employeeCategory, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo });
        await conn.query("UPDATE leave_policies SET status = 'active' WHERE id = ?", [id]);
      }
      const [created] = await loadPolicies(conn, 'WHERE id = ?', [id]);
      await writeMasterAuditSql(conn as never, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(created), action: 'CREATE', after: auditView(created), reason: reasonOf(body) });
      return created;
    });
  } catch (error) {
    missingTable(error);
    duplicate(error);
    throw error;
  }
}

async function lockPolicy(conn: Q, id: number): Promise<Policy> {
  const [rows] = await conn.query<RowDataPacket[]>('SELECT id FROM leave_policies WHERE id = ? FOR UPDATE', [id]);
  if (!rows[0]) throw notFound('Leave policy not found.');
  const [policy] = await loadPolicies(conn, 'WHERE id = ?', [id]);
  return policy;
}

export async function updatePolicy(req: Request, id: number, body: unknown): Promise<Policy> {
  const input = await parsePolicyInput(body);
  try {
    return await inTransaction(async (conn) => {
      const before = await lockPolicy(conn, id);
      if (before.status !== 'draft') {
        throw new HttpError(409, 'An active or inactive policy cannot be edited. Create a new version and change that.', 'LOCKED');
      }
      const sets = POLICY_WRITE.split(',').map((c) => `${c.trim()} = ?`).join(', ');
      await conn.query(`UPDATE leave_policies SET ${sets} WHERE id = ?`, [...policyValues(input, 'draft'), id]);
      await saveItems(conn, id, input.items);
      if (input.status === 'active') {
        await activate(conn, req, { id: String(id), code: input.code, name: input.name, version: input.version, employeeCategory: input.employeeCategory, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo });
        await conn.query("UPDATE leave_policies SET status = 'active' WHERE id = ?", [id]);
      }
      const [updated] = await loadPolicies(conn, 'WHERE id = ?', [id]);
      const beforeView = auditView(before);
      const afterView = auditView(updated);
      const fields = changedFields(beforeView, afterView);
      if (fields.length) {
        await writeMasterAuditSql(conn as never, req, {
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

/** Active <-> inactive, or draft -> active. */
export async function setPolicyStatus(req: Request, id: number, body: unknown): Promise<Policy> {
  const v = new Validator(body);
  const next = v.oneOf('status', ['active', 'inactive'] as const);
  v.assert();
  try {
    return await inTransaction(async (conn) => {
      const before = await lockPolicy(conn, id);
      if (before.status === next) throw new HttpError(409, `This policy is already ${next}.`, 'NO_CHANGE');
      if (next === 'inactive' && before.status !== 'active') throw new HttpError(409, 'Only an active policy can be made inactive.', 'BAD_STATE');
      if (next === 'active') {
        if (before.items.length === 0) throw new HttpError(409, 'Add at least one leave type before activating the policy.', 'EMPTY');
        await activate(conn, req, before);
      }
      await conn.query('UPDATE leave_policies SET status = ? WHERE id = ?', [next, id]);
      const [updated] = await loadPolicies(conn, 'WHERE id = ?', [id]);
      await writeMasterAuditSql(conn as never, req, {
        masterKey: AUDIT_KEY, recordId: id, recordLabel: label(updated), action: 'STATUS', before: { status: before.status }, after: { status: next }, reason: reasonOf(body),
      });
      return updated;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Copies a policy as a new draft version, to be edited and then activated. */
export async function newPolicyVersion(req: Request, id: number, body: unknown): Promise<Policy> {
  const v = new Validator(body);
  const version = v.string('version', { max: 20, pattern: /^[A-Za-z0-9._-]+$/, patternMessage: 'Use letters, numbers, . - or _ only.' });
  const effectiveFrom = v.date('effectiveFrom') ?? '';
  v.assert();
  try {
    return await inTransaction(async (conn) => {
      const source = await lockPolicy(conn, id);
      if (version === source.version) throw new HttpError(400, 'Give the new version a different version number.', 'VALIDATION', { version: 'Use a version number this policy does not have yet.' });
      if (effectiveFrom <= source.effectiveFrom) throw new HttpError(400, 'The new version must start after the version it replaces.', 'VALIDATION', { effectiveFrom: `Must be after ${source.effectiveFrom}.` });
      const copy: PolicyInput = { ...(source as unknown as PolicyInput), version, effectiveFrom, effectiveTo: '', status: 'draft', items: source.items.map((i) => ({ ...i })) };
      const [result] = await conn.query(`INSERT INTO leave_policies (${POLICY_WRITE}, created_by) VALUES (${POLICY_WRITE.split(',').map(() => '?').join(',')}, ?)`,
        [...policyValues(copy, 'draft'), req.auth?.account.id ?? null]);
      const newId = Number((result as { insertId: number }).insertId);
      await saveItems(conn, newId, copy.items);
      const [created] = await loadPolicies(conn, 'WHERE id = ?', [newId]);
      await writeMasterAuditSql(conn as never, req, {
        masterKey: AUDIT_KEY, recordId: newId, recordLabel: label(created), action: 'CREATE', after: auditView(created), reason: reasonOf(body) ?? `New version of ${label(source)}`,
      });
      return created;
    });
  } catch (error) {
    missingTable(error);
    duplicate(error);
    throw error;
  }
}

export async function deletePolicy(req: Request, id: number, reason: string | null): Promise<void> {
  try {
    await inTransaction(async (conn) => {
      const before = await lockPolicy(conn, id);
      if (before.status !== 'draft') throw new HttpError(409, 'An active or inactive policy is kept for the record. Make it inactive instead of deleting it.', 'LOCKED');
      await conn.query('DELETE FROM leave_policy_items WHERE policy_id = ?', [id]);
      await conn.query('DELETE FROM leave_policies WHERE id = ?', [id]);
      await writeMasterAuditSql(conn as never, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(before), action: 'DELETE', before: auditView(before), reason });
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}
