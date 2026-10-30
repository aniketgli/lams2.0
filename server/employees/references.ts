import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { badRequest } from '../lib/http';
import { EmployeeInput, FormLayout, LAYOUT_RULES, MasterRef, isFormLayout } from './fields';

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

/** Form layout of an active employee type, or null if the type is unknown or inactive. */
export async function layoutOfEmployeeType(q: Querier, code: unknown): Promise<FormLayout | null> {
  if (typeof code !== 'string' || !code.trim()) return null;
  const [row] = await rows(q,
    "SELECT metadata FROM lookup_values WHERE lookup_type = 'employee_type' AND code = ? AND UPPER(status) = 'ACTIVE' LIMIT 1",
    [code.trim()]);
  if (!row) return null;
  try {
    const layout = JSON.parse(String(row.metadata || '{}'))?.formLayout;
    return isFormLayout(layout) ? layout : null;
  } catch {
    return null;
  }
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** A comma-separated master value ("a,b") as a list. */
const listOf = (value: unknown): string[] => String(value ?? '').split(',').map((v) => v.trim()).filter(Boolean);

async function activeLookup(q: Querier, type: string, code: string): Promise<boolean> {
  return (await rows(q, "SELECT 1 FROM lookup_values WHERE lookup_type = ? AND code = ? AND UPPER(status) = 'ACTIVE' LIMIT 1", [type, code])).length > 0;
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
}

/**
 * Checks every reference in the form. `selfId` is the account being edited
 * (null when creating) so nobody can be their own manager.
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
    const [row] = await rows(q, "SELECT metadata FROM designations WHERE name = ? AND UPPER(status) = 'ACTIVE' LIMIT 1", [input.designation]);
    const meta = jsonObject(row?.metadata);
    if (!row) errors.designation = 'Choose an active designation from Master Settings.';
    else if (meta.empType && String(meta.empType) !== input.employmentType) errors.designation = 'This designation is not for the selected employee type.';
    else if (rules.category && input.employeeCategory && meta.cadre && String(meta.cadre) !== input.employeeCategory) errors.designation = 'This designation is not for the selected cadre.';
  }

  // Course and batch: trainees pick a training course and its batch, M.Sc students a stream and its batch.
  if (rules.course && input.courseProgram) {
    const msc = layout === 'bsc_msc_student';
    const courseTable = msc ? 'msc_streams' : 'training_courses';
    const batchTable = msc ? 'msc_batches' : 'trainee_batches';
    const parentPath = msc ? '$.parentStream' : '$.parentCourse';
    const noun = msc ? 'stream' : 'course';
    const course = await rows(q, `SELECT 1 FROM ${courseTable} WHERE name = ? AND UPPER(status) = 'ACTIVE' LIMIT 1`, [input.courseProgram]);
    if (!course.length) errors.courseProgram = `Choose an active ${noun} from Master Settings.`;
    else if (input.courseBatch) {
      const [batch] = await rows(q,
        `SELECT JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(metadata), metadata, '{}'), '${parentPath}')) AS parent
           FROM ${batchTable} WHERE name = ? AND UPPER(status) = 'ACTIVE' LIMIT 1`, [input.courseBatch]);
      if (!batch) errors.courseBatch = 'Choose an active batch from Master Settings.';
      else if (String(batch.parent ?? '') !== input.courseProgram) errors.courseBatch = `This batch is not for the selected ${noun}.`;
    }
  }

  // A department / cell must belong to the employee's institute (projects are shared),
  // and, when the unit is limited to some employee types or cadres, fit this employee.
  if (rules.department && input.department && !errors.department && !errors.institute) {
    const [unit] = await rows(q, "SELECT * FROM organization_units WHERE name = ? AND UPPER(status) = 'ACTIVE' LIMIT 1", [input.department]);
    if (unit && unit.institute && String(unit.institute) !== input.institute) {
      errors.department = 'This department belongs to another organization. Choose one from the selected organization.';
    } else if (unit) {
      const meta = jsonObject(unit.metadata);
      const empTypes = listOf(meta.empTypes);
      const cadres = listOf(meta.cadres);
      if (empTypes.length && !empTypes.includes(input.employmentType)) {
        errors.department = 'This department is not for the selected employee type.';
      } else if (rules.category && input.employeeCategory && cadres.length && !cadres.includes(input.employeeCategory)) {
        errors.department = 'This department is not for the selected cadre.';
      }
    }
  }

  // Managers must be active accounts of the same institute (when their institute is recorded).
  const activeAccount = async (id: string) => {
    const [row] = await rows(q,
      `SELECT u.id, u.name, u.status, p.institute FROM users u
         LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [Number(id)]);
    if (!row || String(row.status).toLowerCase() !== 'active') return null;
    if (row.institute && input.institute && String(row.institute) !== input.institute) return null;
    return row;
  };

  let reportingManagerName: string | null = null;
  if (input.reportingManagerId) {
    if (selfId !== null && Number(input.reportingManagerId) === selfId) errors.reportingManagerId = 'An employee cannot report to themselves.';
    else {
      const manager = await activeAccount(input.reportingManagerId);
      if (!manager) errors.reportingManagerId = 'Choose an active employee of the same organization as the reporting manager.';
      else reportingManagerName = String(manager.name);
    }
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
      if (selfId !== null && Number(reviewingManagerId) === selfId) errors.reviewingManagerId = 'An employee cannot be their own HoD.';
      else {
        const hod = await activeAccount(reviewingManagerId);
        if (!hod) errors.reviewingManagerId = 'Choose an active employee of the same organization as the HoD.';
        else hodName = String(hod.name);
      }
    }
  }

  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
  return { reviewingManagerId: rules.hod ? reviewingManagerId : null, hodName, reportingManagerName };
}
