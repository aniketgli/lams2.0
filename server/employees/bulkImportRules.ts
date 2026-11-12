import { isValidIsoDate } from '../lib/validate';
import { CADRES, LAYOUT_RULES, RECRUITMENT_CATEGORIES, type FormLayout } from './fields';

/** Employee import: columns of each employee type's template and how cells are read. Pure, tested in bulkImport.test.ts. */

export const MAX_EMPLOYEE_IMPORT_ROWS = 300;

export type ColumnKind = 'text' | 'date' | 'bool' | 'person' | 'lookup' | 'shift' | 'leaveGroup' | 'choice';

export interface ImportColumn {
  header: string;
  /** The field of the employee form it fills. */
  key: string;
  required: boolean;
  kind: ColumnKind;
  /** lookup type (salutation, gender, institute) or the fixed list of a choice. */
  lookup?: string;
  choices?: readonly string[];
  hint: string;
}

const col = (header: string, key: string, required: boolean, kind: ColumnKind, hint: string, extra: Partial<ImportColumn> = {}): ImportColumn =>
  ({ header, key, required, kind, hint, ...extra });

/** The columns of the template for one form layout, in form order. */
export function columnsFor(layout: FormLayout): ImportColumn[] {
  const rules = LAYOUT_RULES[layout];
  const out: ImportColumn[] = [
    col('Biometric_ID', 'biometricId', true, 'text', '4 digits'),
    col('Salutation', 'suffix', true, 'lookup', 'as in Master Settings', { lookup: 'salutation' }),
    col('Name', 'name', true, 'text', 'full name'),
    col('Email', 'email', true, 'text', 'official email (login ID)'),
    col('Mobile', 'phone', true, 'text', '10 digit mobile'),
    col('Gender', 'gender', true, 'lookup', 'as in Master Settings', { lookup: 'gender' }),
    col('Date_of_Birth', 'dob', true, 'date', 'DD-MM-YYYY'),
    col('Date_of_Joining', 'joiningDate', true, 'date', 'DD-MM-YYYY'),
    col('Institute', 'institute', true, 'lookup', 'as in Master Settings', { lookup: 'institute' }),
  ];
  if (rules.department === 'organizations') out.push(col('Department', 'department', true, 'text', 'department / cell name'));
  if (rules.department === 'projects') out.push(col('Project', 'department', true, 'text', 'project name'));
  if (rules.department === 'departmentOrProject') out.push(col('Department_or_Project', 'department', true, 'text', 'department or project name'));
  if (rules.designation) out.push(col('Designation', 'designation', true, 'text', 'designation name'));
  if (rules.category) out.push(col('Cadre', 'employeeCategory', true, 'choice', CADRES.join(' / '), { choices: CADRES }));
  if (layout === 'permanent') out.push(col('Recruitment', 'permanentEmploymentType', true, 'choice', 'Direct / Deputation', { choices: RECRUITMENT_CATEGORIES }));
  if (rules.course) {
    const msc = layout === 'bsc_msc_student';
    out.push(col(msc ? 'Stream' : 'Course', 'courseProgram', true, 'text', msc ? 'M.Sc stream name' : 'course name'));
    out.push(col('Batch', 'courseBatch', true, 'text', 'batch name of that course'));
  }
  if (rules.enrollment) out.push(col('Enrolled_Through', 'enrolledThrough', true, 'text', 'enrollment source name'));
  out.push(
    col('Shift', 'shiftId', true, 'shift', 'shift name'),
    col('Leave_Group', 'leaveGroup', true, 'leaveGroup', 'leave group code or name'),
    col('Reporting_Manager_BI', 'reportingManagerId', true, 'person', 'B.I. of an employee (may be in this file, above)'),
  );
  if (rules.hod) out.push(col('HoD_BI', 'reviewingManagerId', true, 'person', 'B.I. of an employee (may be in this file, above)'));
  if (rules.validUntil === 'always') out.push(col('Valid_Upto', 'validUntilDate', true, 'date', 'DD-MM-YYYY'));
  if (rules.validUntil === 'deputation') out.push(col('Valid_Upto', 'validUntilDate', false, 'date', 'DD-MM-YYYY, only for Deputation'));
  if (rules.probation) {
    out.push(col('On_Probation', 'isOnProbation', false, 'bool', 'Yes / No'));
    out.push(col('Probation_End', 'probationEndDate', false, 'date', 'DD-MM-YYYY, when on probation'));
  }
  if (rules.phdFlag) out.push(col('PhD_Enrolled', 'isPhDEnrolled', false, 'bool', 'Yes / No'));
  if (rules.piName) out.push(col('PI_Name', 'piName', false, 'text', 'blank = the reporting manager'));
  if (rules.guide) out.push(col('Guide', 'guideSupervisor', false, 'text', 'guide / supervisor name'));
  out.push(col('PwD', 'isPwd', false, 'bool', 'Yes / No'));
  return out;
}

/** "2026-01-31", "31-01-2026", "31/01/2026" or "31.01.2026" → "2026-01-31"; null when it is none of them. */
export function parseDay(text: string): string | null {
  const t = text.trim();
  let iso: string | null = null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (m) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return iso && isValidIsoDate(iso) ? iso : null;
}

/** Yes / No (also Y / N, True / False, 1 / 0); blank is No; null when it is something else. */
export function parseYesNo(text: string): boolean | null {
  const t = text.trim().toLowerCase();
  if (['', 'no', 'n', 'false', '0'].includes(t)) return false;
  if (['yes', 'y', 'true', '1'].includes(t)) return true;
  return null;
}

/**
 * Order in which the rows are created: a row whose reporting manager / HoD is another row of the file comes after that
 * row. Rows in a loop (A reports to B, B to A) are returned in `cycle`.
 */
export function creationOrder(rows: ReadonlyArray<{ bi: string; managers: string[] }>): { order: number[]; cycle: number[] } {
  const index = new Map<string, number>();
  rows.forEach((r, i) => { if (r.bi && !index.has(r.bi)) index.set(r.bi, i); });
  const state = new Array<number>(rows.length).fill(0); // 0 new, 1 visiting, 2 done
  const order: number[] = [];
  const cycle = new Set<number>();
  const visit = (i: number, path: number[]): boolean => {
    if (state[i] === 2) return true;
    if (state[i] === 1) { for (const j of path.slice(path.indexOf(i))) cycle.add(j); return false; }
    state[i] = 1;
    let ok = true;
    for (const m of rows[i].managers) {
      const j = index.get(m);
      if (j !== undefined && j !== i && !visit(j, [...path, i])) ok = false;
    }
    state[i] = 2;
    if (ok && !cycle.has(i)) order.push(i);
    return ok;
  };
  rows.forEach((_, i) => visit(i, [i]));
  return { order, cycle: [...cycle].sort((a, b) => a - b) };
}

