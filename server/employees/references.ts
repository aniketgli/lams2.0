import { lookupTable } from '../lib/lookups';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { badRequest } from '../lib/http';
import { normalizeModule, normalizeRole } from '../lib/roles';
import { EmployeeInput, FormLayout, LAYOUT_RULES, MasterRef, isFormLayout } from './fields';
import { type ManagerKind, type PeopleModule, holdsManagerRole, managerRoleMessage, someoneHoldsManagerRole } from './managerRoles';

/**
 * Database checks for the employee form: every dropdown value must be an
 * active master / list entry, the shift must be active and managers must be
 * real, active accounts. Errors are returned per field so the form can show
 * them next to the right input.
 */

type Querier = Pick<PoolConnection, 'query'> | typeof pool;

async function rows(q: Querier, sql: string, params: unknown[]): Promise<RowDataPacket[]> {
  const [result] = await q.query<RowDataPacket[]>(sql, params);
  return result;
}

// ---------------------------------------------------------------------------
// HRMS / PMS: which module an employee type belongs to (employee_types.module)
// ---------------------------------------------------------------------------

export type EmployeeModule = 'HRMS' | 'PMS';
/** Layouts of the HRMS types, used only until migrations/20261225_hrms_pms_split.sql adds employee_types.module. */
const HRMS_LAYOUTS = new Set(['permanent', 'diploma_trainee']);

/** The module whose employees the signed-in session manages: the module it is working in. */
export function sessionEmployeeModule(req: { auth?: { activeModule?: string | null } | null }): EmployeeModule | null {
  const module = normalizeModule(req.auth?.activeModule ?? '');
  return module === 'hrms' ? 'HRMS' : module === 'pms' ? 'PMS' : null;
}

/** Every employee type with its module (inactive ones too: an existing employee keeps their type). */
export async function employeeTypeModules(q: Querier): Promise<Map<string, EmployeeModule>> {
  let list: RowDataPacket[];
  try {
    list = await rows(q, 'SELECT code, module, form_layout FROM employee_types', []);
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ER_BAD_FIELD_ERROR') throw error;
    list = (await rows(q, 'SELECT code, form_layout FROM employee_types', [])).map((r) => ({ ...r, module: HRMS_LAYOUTS.has(String(r.form_layout)) ? 'HRMS' : 'PMS' }) as RowDataPacket);
  }
  return new Map(list.map((r) => [String(r.code), String(r.module).toUpperCase() === 'PMS' ? 'PMS' : 'HRMS'] as const));
}

/**
 * A new employee, an imported one, or a change of employee type must use a type of the session's module: the HRMS
 * form offers Permanent and Trainee, the PMS one the other types. An employee who keeps their type is not checked.
 */
export async function assertTypeInModule(q: Querier, req: { auth?: { activeModule?: string | null } | null }, code: unknown, kept: string | null = null): Promise<void> {
  const type = String(code ?? '').trim();
  if (!type || (kept !== null && type === kept)) return;
  const module = sessionEmployeeModule(req);
  const of = (await employeeTypeModules(q)).get(type);
  if (!module || !of) return; // unknown type: the form check names it
  if (of !== module) {
    const message = `This employee type belongs to ${of}. ${module} employees are ${module === 'HRMS' ? 'Permanent and Trainee' : 'the project / contract types'} (Master Settings → Employee Types).`;
    throw badRequest('Please correct the highlighted fields.', { employmentType: message });
  }
}

/** Form layout of an active employee type, or null if the type is unknown or inactive. */
export async function layoutOfEmployeeType(q: Querier, code: unknown): Promise<FormLayout | null> {
  if (typeof code !== 'string' || !code.trim()) return null;
  const [row] = await rows(q,
    "SELECT form_layout FROM employee_types WHERE code = ? AND UPPER(status) = 'ACTIVE' LIMIT 1",
    [code.trim()]);
  return row && isFormLayout(row.form_layout) ? row.form_layout : null;
}

/** A comma-separated master value ("a,b") as a list. */

async function activeLookup(q: Querier, type: string, code: string): Promise<boolean> {
  return (await rows(q, `SELECT 1 FROM ${lookupTable(type)} WHERE code = ? AND UPPER(status) = 'ACTIVE' LIMIT 1`, [code])).length > 0;
}

const MASTER_TABLES: Record<Exclude<MasterRef, 'batches' | 'departmentOrProject'>, string> = {
  organizations: 'organization_units',
  designations: 'designations',
  categories: 'categories',
  projects: 'projects',
  courses: 'training_courses',
  phdEnrollment: 'phd_enrollments',
};

/** Whether `name` is an active value of the master. Table names come only from the map above. */
export async function activeMasterValue(q: Querier, ref: MasterRef, name: string): Promise<boolean> {
  const tables = ref === 'batches' ? ['trainee_batches', 'msc_batches']
    : ref === 'departmentOrProject' ? ['organization_units', 'projects']
      : [MASTER_TABLES[ref]];
  for (const table of tables) {
    const found = await rows(q, `SELECT 1 FROM ${table} WHERE name = ? AND UPPER(status) = 'ACTIVE' LIMIT 1`, [name]);
    if (found.length) return true;
  }
  return false;
}

export interface ResolvedReferences {
  reviewingManagerId: string | null;
  hodName: string | null;
  reportingManagerName: string | null;
  /** Leave year of the employee's leave group. */
  leaveCycle: 'CY' | 'FY';
}

/**
 * Checks every reference in the form. `selfId` is the account being edited (null when creating).
 * An employee may be their own reporting manager and HoD, as a Director is.
 * Throws a 400 with field-level details when anything is wrong.
 */
export async function checkReferences(q: Querier, input: EmployeeInput, layout: FormLayout, selfId: number | null): Promise<ResolvedReferences> {
  const errors: Record<string, string> = {};
  const rules = LAYOUT_RULES[layout];

  if (!await activeLookup(q, 'salutation', input.salutation)) errors.suffix = 'Choose a salutation from the list.';
  if (!await activeLookup(q, 'gender', input.gender)) errors.gender = 'Choose a gender from the list.';
  if (!await activeLookup(q, 'institute', input.institute)) errors.institute = 'Choose an organization from the list.';

  const [shift] = await rows(q, 'SELECT id, status FROM shifts WHERE id = ? LIMIT 1', [Number(input.shiftId)]);
  if (!shift || String(shift.status).toLowerCase() !== 'active') errors.shiftId = 'Choose an active shift.';

  let leaveCycle: 'CY' | 'FY' = 'CY';
  if (input.leaveGroup) {
    const [group] = await rows(q, "SELECT leave_year FROM leave_groups WHERE code = ? AND status = 'active' LIMIT 1", [input.leaveGroup]);
    if (!group) errors.leaveGroup = 'Choose an active leave group from Master Settings.';
    else leaveCycle = String(group.leave_year) === 'FY' ? 'FY' : 'CY';
  }

  const masterChecks: [keyof EmployeeInput, MasterRef | undefined, string][] = [
    ['department', rules.department, rules.department === 'projects' ? 'project' : 'department'],
    ['enrolledThrough', rules.enrollment ? 'phdEnrollment' : undefined, 'enrollment source'],
  ];
  for (const [field, ref, noun] of masterChecks) {
    const value = input[field];
    if (!ref || typeof value !== 'string') continue;
    if (!await activeMasterValue(q, ref, value)) errors[field] = `Choose an active ${noun} from Master Settings.`;
  }

  // A designation may be tied to one employee type; if so it must be this one.
  if (rules.designation && input.designation) {
    // The same name may exist once per employment type: prefer the one of this type, then a shared one.
    const [row] = await rows(q,
      `SELECT employee_type_code, cadre_code FROM designations WHERE name = ? AND UPPER(status) = 'ACTIVE'
        ORDER BY (employee_type_code = ?) DESC, (employee_type_code IS NULL) DESC LIMIT 1`, [input.designation, input.employmentType]);
    if (!row) errors.designation = 'Choose an active designation from Master Settings.';
    else if (row.employee_type_code && String(row.employee_type_code) !== input.employmentType) errors.designation = 'This designation is not for the selected employee type.';
    else if (rules.category && input.employeeCategory && row.cadre_code && String(row.cadre_code) !== input.employeeCategory) errors.designation = 'This designation is not for the selected cadre.';
  }

  // Course and batch: trainees pick a training course and its batch, M.Sc students a stream and its batch.
  if (rules.course && input.courseProgram) {
    const msc = layout === 'bsc_msc_student';
    const courseTable = msc ? 'msc_streams' : 'training_courses';
    const batchTable = msc ? 'msc_batches' : 'trainee_batches';
    const parentColumn = msc ? 'msc_stream_name' : 'training_course_name';
    const noun = msc ? 'stream' : 'course';
    const course = await rows(q, `SELECT 1 FROM ${courseTable} WHERE name = ? AND UPPER(status) = 'ACTIVE' LIMIT 1`, [input.courseProgram]);
    if (!course.length) errors.courseProgram = `Choose an active ${noun} from Master Settings.`;
    else if (input.courseBatch) {
      const [batch] = await rows(q,
        `SELECT ${parentColumn} AS parent FROM ${batchTable} WHERE name = ? AND UPPER(status) = 'ACTIVE' LIMIT 1`, [input.courseBatch]);
      if (!batch) errors.courseBatch = 'Choose an active batch from Master Settings.';
      else if (String(batch.parent ?? '') !== input.courseProgram) errors.courseBatch = `This batch is not for the selected ${noun}.`;
    }
  }

  // A department / cell must belong to the employee's institute (projects are shared).
  if (rules.department && input.department && !errors.department && !errors.institute) {
    const [unit] = await rows(q, "SELECT * FROM organization_units WHERE name = ? AND UPPER(status) = 'ACTIVE' LIMIT 1", [input.department]);
    if (unit && unit.institute && String(unit.institute) !== input.institute) {
      errors.department = 'This department belongs to another organization. Choose one from the selected organization.';
    }
  }

  // Managers must be active accounts of the same institute (when their institute is recorded). Of the system accounts,
  // only the Administrator may be chosen (the form offers it while no employee is registered yet).
  // They must also hold that HRMS role (managerRoles.ts). A manager the employee already has stays accepted on an
  // edit, so other changes to an older profile can still be saved.
  const [current] = selfId
    ? await rows(q, `SELECT p.reporting_manager_id, p.reviewing_manager_id FROM users u
                       JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [selfId])
    : [];
  const roleError: Record<ManagerKind, string | null> = { reporting: null, hod: null };
  // The manager roles of the employee's module: PMS employees need the PMS Reporting Manager / HoD, HRMS ones the HRMS roles.
  const people: PeopleModule = (await employeeTypeModules(q)).get(String(input.employmentType ?? '')) ?? 'HRMS';
  const activeAccount = async (id: string, kind: ManagerKind) => {
    const [row] = await rows(q,
      `SELECT u.id, u.biometric_id, u.name, u.status, u.is_system, p.institute FROM users u
         LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [Number(id)]);
    if (!row || String(row.status).toLowerCase() !== 'active') return null;
    const system = Number(row.is_system ?? 0) === 1;
    if (system && !(await isSystemAdministrator(q, String(row.biometric_id)))) return null;
    // A manager may belong to another institute (a SACON employee can report to someone at WII).
    const kept = String(current?.[kind === 'reporting' ? 'reporting_manager_id' : 'reviewing_manager_id'] ?? '') === String(row.id);
    if (!kept) {
      const ok = system
        ? !(await someoneHoldsManagerRole(q, kind, people)) // the Administrator only until an employee holds the role
        : await holdsManagerRole(q, String(row.biometric_id), kind, people);
      if (!ok) { roleError[kind] = managerRoleMessage(kind, people); return null; }
    }
    return row;
  };

  let reportingManagerName: string | null = null;
  if (input.reportingManagerId) {
    // An employee may be their own reporting manager (a Director is).
    const manager = await activeAccount(input.reportingManagerId, 'reporting');
    if (!manager) errors.reportingManagerId = roleError.reporting ?? 'Choose an active employee as the reporting manager.';
    else reportingManagerName = String(manager.name);
  }

  let reviewingManagerId = input.reviewingManagerId;
  let hodName: string | null = null;
  if (rules.hod) {
    if (!reviewingManagerId && input.hodName) {
      // Older forms pick the HoD by name; accept it only if exactly one active account has that name.
      const matches = await rows(q, "SELECT id FROM users WHERE name = ? AND LOWER(status) = 'active' LIMIT 2", [input.hodName]);
      if (matches.length === 1) reviewingManagerId = String(matches[0].id);
      else errors.reviewingManagerId = matches.length ? 'More than one employee has this name; choose the HoD again.' : 'Choose an active employee as the HoD.';
    }
    if (reviewingManagerId && !errors.reviewingManagerId) {
      // An employee may be their own HoD (a Director is).
      const hod = await activeAccount(reviewingManagerId, 'hod');
      if (!hod) errors.reviewingManagerId = roleError.hod ?? 'Choose an active employee as the HoD.';
      else hodName = String(hod.name);
    }
  }

  // Biometric ID form for the institute (new employees; an existing ID is never changed).
  if (selfId === null && input.biometricId && input.institute) {
    const [inst] = await rows(q, 'SELECT biometric_id_format FROM institutes WHERE code = ? LIMIT 1', [input.institute]);
    const lettersAllowed = String(inst?.biometric_id_format ?? '4 digits') === 'Letters and digits';
    if (!lettersAllowed && !/^\d{4}$/.test(input.biometricId)) errors.biometricId = 'Biometric ID must be exactly 4 digits for this institute.';
    else if (lettersAllowed && !/^[A-Z0-9]{2,10}$/.test(input.biometricId)) errors.biometricId = 'Use 2 to 10 letters or digits (e.g. SAC1001).';
  }

  // Bank: one of the Banks master (an inactive bank stays allowed for the employee who already has it).
  const bankName = input.identity?.bankName;
  if (bankName) {
    const [bank] = await rows(q, 'SELECT name, status FROM banks WHERE name = ? LIMIT 1', [bankName]);
    let allowed = Boolean(bank) && String(bank.status).toUpperCase() === 'ACTIVE';
    if (bank && !allowed && selfId) {
      const [own] = await rows(q, `SELECT 1 FROM employee_bank_accounts a JOIN users u ON u.biometric_id = a.biometric_id
                                    WHERE u.id = ? AND a.bank_name = ? LIMIT 1`, [selfId, bank.name]);
      allowed = Boolean(own);
    }
    if (!allowed) errors.bankName = 'Choose a bank from the list (Master Settings → Banks).';
    else input.identity.bankName = String(bank.name); // the master's spelling
  }

  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
  return { reviewingManagerId: rules.hod ? reviewingManagerId : null, hodName, reportingManagerName, leaveCycle };
}

/** A system account holding the HRMS Administrator role (the fixed Administrator, not the Auditor). */
async function isSystemAdministrator(q: Querier, biometricId: string): Promise<boolean> {
  const grants = await rows(q, "SELECT module_id, role_id FROM user_module_roles WHERE biometric_id = ? AND LOWER(status) = 'active'", [biometricId]);
  return grants.some((g) => normalizeModule(g.module_id) === 'hrms' && normalizeRole(g.role_id) === 'administrator');
}
