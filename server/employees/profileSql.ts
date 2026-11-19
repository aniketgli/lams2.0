/**
 * Employee profile fields live in their own columns of employee_profiles (one value per column), see
 * migrations/20261218_employee_profile_columns.sql. Aadhaar / PAN are in employee_identity and bank details in
 * employee_bank_accounts (identityStore.ts).
 *
 * Most screens still work with a "profile object" keyed by the form's names (gender, dob, reportingManagerId, …).
 * profileJsonSql() builds that object in the SELECT from the columns, so a query reads
 *     SELECT …, ${profileJsonSql('p')} AS profile_data FROM users u LEFT JOIN employee_profiles p …
 * and profileValues() turns the object back into column values for INSERT / UPDATE.
 *
 * Values that follow from other data are not stored: the leave year (from the leave group), its "basis" and the HoD's
 * name (from the HoD's account) are worked out when reading.
 */

export type ProfileFieldKind = 'text' | 'date' | 'bool' | 'id';

export interface ProfileField { key: string; column: string; kind: ProfileFieldKind; max?: number }

/** Every stored profile field: form key → column. */
export const PROFILE_FIELDS: readonly ProfileField[] = [
  { key: 'gender', column: 'gender', kind: 'text', max: 20 },
  { key: 'dob', column: 'dob', kind: 'date' },
  { key: 'bloodGroup', column: 'blood_group', kind: 'text', max: 3 },
  { key: 'leaveGroup', column: 'leave_group', kind: 'text', max: 50 },
  { key: 'employeeCategory', column: 'employee_category', kind: 'text', max: 100 },
  { key: 'permanentEmploymentType', column: 'permanent_employment_type', kind: 'text', max: 20 },
  { key: 'reportingManagerId', column: 'reporting_manager_id', kind: 'id' },
  { key: 'reviewingManagerId', column: 'reviewing_manager_id', kind: 'id' },
  { key: 'validUntilDate', column: 'valid_until_date', kind: 'date' },
  { key: 'isOnProbation', column: 'is_on_probation', kind: 'bool' },
  { key: 'probationEndDate', column: 'probation_end_date', kind: 'date' },
  { key: 'isPwd', column: 'is_pwd', kind: 'bool' },
  { key: 'isPhDEnrolled', column: 'is_phd_enrolled', kind: 'bool' },
  { key: 'piName', column: 'pi_name', kind: 'text', max: 255 },
  { key: 'courseProgram', column: 'course_program', kind: 'text', max: 255 },
  { key: 'courseBatch', column: 'course_batch', kind: 'text', max: 255 },
  { key: 'enrolledThrough', column: 'enrolled_through', kind: 'text', max: 255 },
  { key: 'guideSupervisor', column: 'guide_supervisor', kind: 'text', max: 255 },
  { key: 'retirementDate', column: 'retirement_date', kind: 'date' },
  { key: 'statusChangeReason', column: 'status_change_reason', kind: 'text', max: 500 },
  { key: 'statusEffectiveDate', column: 'status_effective_date', kind: 'date' },
  { key: 'statusChangedBy', column: 'status_changed_by', kind: 'text', max: 50 },
];

const BY_KEY = new Map(PROFILE_FIELDS.map((f) => [f.key, f]));

/** Column of a profile field (for WHERE / COUNT queries), or throws for an unknown key. */
export function profileColumn(key: string): string {
  const field = BY_KEY.get(key);
  if (!field) throw new Error(`Unknown profile field: ${key}`);
  return field.column;
}

/**
 * SQL expression giving the profile object of the employee_profiles row aliased `alias`. Keys whose value is empty
 * come out as JSON null and are dropped by the readers (profileObject), as when the data was kept as JSON text.
 */
export function profileJsonSql(alias = 'p'): string {
  const a = alias;
  const parts = PROFILE_FIELDS.map((f) => {
    const col = `${a}.${f.column}`;
    switch (f.kind) {
      case 'date': return `'${f.key}', DATE_FORMAT(${col}, '%Y-%m-%d')`;
      // Only "true" is kept, as before: a false flag reads as not set.
      case 'bool': return `'${f.key}', IF(${col} = 1, CAST('true' AS JSON), NULL)`;
      // Account ids travel as text, as they always did.
      case 'id': return `'${f.key}', CAST(${col} AS CHAR)`;
      default: return `'${f.key}', ${col}`;
    }
  });
  const leaveYear = `(SELECT lg.leave_year FROM leave_groups lg WHERE lg.code = ${a}.leave_group LIMIT 1)`;
  parts.push(
    `'leaveCycle', IF(${a}.biometric_id IS NULL, NULL, IF(${leaveYear} = 'FY', 'FY', 'CY'))`,
    `'leaveCycleBasis', IF(${a}.biometric_id IS NULL, NULL, IF(${leaveYear} = 'FY', 'financial_year', 'calendar_year'))`,
    `'hodName', (SELECT hu.name FROM users hu WHERE hu.id = ${a}.reviewing_manager_id)`,
  );
  return `JSON_OBJECT(${parts.join(', ')})`;
}

/** Reads a profile object as it comes from the database (JSON text or an already parsed object), without empty keys. */
export function profileObject(raw: unknown): Record<string, unknown> {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw || '{}'); } catch { value = {}; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (v !== null && v !== undefined && v !== '') out[k] = v;
  return out;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Column values of a profile object, for INSERT / UPDATE. Missing or empty keys become NULL (false for flags). */
export function profileValues(data: Record<string, unknown>): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const f of PROFILE_FIELDS) {
    const v = data[f.key];
    const empty = v === undefined || v === null || v === '';
    switch (f.kind) {
      case 'bool': out[f.column] = v === true || v === 'true' || v === 1 || v === '1' ? 1 : 0; break;
      case 'date': out[f.column] = !empty && DATE_RE.test(String(v).slice(0, 10)) ? String(v).slice(0, 10) : null; break;
      case 'id': out[f.column] = !empty && /^\d{1,18}$/.test(String(v)) ? Number(v) : null; break;
      default: out[f.column] = empty ? null : String(v).slice(0, f.max ?? 255);
    }
  }
  return out;
}

/** `col1 = ?, col2 = ?, …` and the matching values, for an UPDATE of every profile column. */
export function profileSetClause(data: Record<string, unknown>): { sql: string; params: Array<string | number | null> } {
  const values = profileValues(data);
  const cols = Object.keys(values);
  return { sql: cols.map((c) => `${c} = ?`).join(', '), params: cols.map((c) => values[c]) };
}
