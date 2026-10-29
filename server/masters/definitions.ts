import type { RowDataPacket } from 'mysql2';
import { pool } from '../../src/db';

/**
 * Registry of every simple master (name + code + status + a few extra fields).
 * Routes, validation, usage checks, the audit trail and the employee-form
 * dropdowns are all driven from these definitions, so adding a master means
 * adding one entry here.
 *
 * Shift, Biometric Machine and Organization settings have their own routes
 * because their records have many specialised fields.
 */

/** How the employee form behaves for an employee type (fixed set, chosen per type). */
export const FORM_LAYOUTS = [
  { code: 'permanent', name: 'Permanent staff (department, designation, category)' },
  { code: 'contractual', name: 'Contractual staff (department, designation, category)' },
  { code: 'researcher', name: 'Project staff (project, designation)' },
  { code: 'diploma_trainee', name: 'Trainee (course, batch)' },
  { code: 'bsc_msc_student', name: 'M.Sc student (course, batch)' },
  { code: 'phd_student', name: 'PhD scholar (enrollment source)' },
  { code: 'intern', name: 'Intern (department)' },
] as const;

export type FieldType = 'text' | 'lookup' | 'master' | 'layout';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  maxLength?: number;
  /** For type 'lookup': lookup_values.lookup_type supplying the options (stored by code). */
  lookupType?: string;
  /** For type 'master': another master supplying the options (stored by name). */
  masterKey?: string;
  placeholder?: string;
}

interface UsageCheck {
  /** Human description, e.g. "employee profiles". */
  what: string;
  /** SQL returning one row with column `n`; `?` receives the record's value. */
  sql: string;
  /** Which value of the record the query compares against. */
  by: 'name' | 'code';
}

interface BaseDef {
  key: string;
  label: string;
  /** Singular noun for messages ("Designation"). */
  noun: string;
  group: 'profile' | 'lists';
  description: string;
  fields: FieldDef[];
  usage: UsageCheck[];
}

export interface TableMasterDef extends BaseDef {
  kind: 'table';
  table: string;
  /** Extra fields stored in real columns rather than the metadata JSON. */
  columnFields?: Record<string, string>;
  /** Whether the table has a `metadata` JSON column (organization_units does not). */
  hasMetadata: boolean;
  codeMaxLength: number;
}

export interface LookupMasterDef extends BaseDef {
  kind: 'lookup';
  lookupType: string;
}

export type MasterDef = TableMasterDef | LookupMasterDef;

// Usage-check helpers. Values in profile_data / metadata are JSON stored in text columns.
const PROFILE_COLUMN = (column: string): string =>
  `SELECT COUNT(*) AS n FROM employee_profiles WHERE ${column} = ?`;
const PROFILE_JSON = (path: string): string =>
  `SELECT COUNT(*) AS n FROM employee_profiles WHERE JSON_VALID(profile_data) AND JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.${path}')) = ?`;
const METADATA_JSON = (table: string, path: string): string =>
  `SELECT COUNT(*) AS n FROM ${table} WHERE JSON_VALID(metadata) AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.${path}')) = ?`;

export const MASTERS: MasterDef[] = [
  // ---- Profile masters --------------------------------------------------------
  {
    kind: 'table', key: 'organizations', table: 'organization_units', group: 'profile', codeMaxLength: 80, hasMetadata: false,
    label: 'Organizations', noun: 'Organization unit',
    description: 'Departments, divisions, cells and units.',
    columnFields: { type: 'type' },
    fields: [{ key: 'type', label: 'Type', type: 'lookup', lookupType: 'org_unit_type', required: true }],
    usage: [
      { what: 'employee profiles', sql: PROFILE_COLUMN('department'), by: 'name' },
    ],
  },
  {
    kind: 'table', key: 'designations', table: 'designations', group: 'profile', codeMaxLength: 100, hasMetadata: true,
    label: 'Designations', noun: 'Designation',
    description: 'Job titles and positions.',
    fields: [{ key: 'empType', label: 'Employment type', type: 'lookup', lookupType: 'employee_type' }],
    usage: [{ what: 'employee profiles', sql: PROFILE_COLUMN('designation'), by: 'name' }],
  },
  {
    kind: 'table', key: 'categories', table: 'categories', group: 'profile', codeMaxLength: 100, hasMetadata: true,
    label: 'Employee Categories', noun: 'Category',
    description: 'Administrative, scientific, technical and academic categories.',
    fields: [{ key: 'group', label: 'Cadre group', type: 'lookup', lookupType: 'cadre_group' }],
    usage: [{ what: 'employee profiles', sql: PROFILE_JSON('employeeCategory'), by: 'name' }],
  },
  {
    kind: 'table', key: 'projects', table: 'projects', group: 'profile', codeMaxLength: 100, hasMetadata: true,
    label: 'Projects', noun: 'Project',
    description: 'Research projects and grant units.',
    fields: [{ key: 'pi', label: 'Principal Investigator', type: 'text', maxLength: 255, placeholder: 'Name of the PI' }],
    usage: [
      { what: 'employee profiles', sql: PROFILE_COLUMN('department'), by: 'name' },
      { what: 'project histories', sql: 'SELECT COUNT(*) AS n FROM user_histories WHERE project_name = ?', by: 'name' },
    ],
  },
  {
    kind: 'table', key: 'courses', table: 'training_courses', group: 'profile', codeMaxLength: 100, hasMetadata: true,
    label: 'Courses', noun: 'Course',
    description: 'Diploma, certificate and training programmes.',
    fields: [],
    usage: [
      { what: 'employee profiles', sql: PROFILE_JSON('courseProgram'), by: 'name' },
      { what: 'trainee batches', sql: METADATA_JSON('trainee_batches', 'parentCourse'), by: 'name' },
    ],
  },
  {
    kind: 'table', key: 'traineeBatches', table: 'trainee_batches', group: 'profile', codeMaxLength: 100, hasMetadata: true,
    label: 'Trainee Batches', noun: 'Trainee batch',
    description: 'Trainee cohorts per course.',
    fields: [
      { key: 'parentCourse', label: 'Course', type: 'master', masterKey: 'courses', required: true },
      { key: 'validity', label: 'Year / validity', type: 'text', maxLength: 50, required: true, placeholder: 'e.g. 2026' },
    ],
    usage: [{ what: 'employee profiles', sql: PROFILE_JSON('courseBatch'), by: 'name' }],
  },
  {
    kind: 'table', key: 'mscStreams', table: 'msc_streams', group: 'profile', codeMaxLength: 100, hasMetadata: true,
    label: 'M.Sc Streams', noun: 'Stream',
    description: 'Postgraduate streams and disciplines.',
    fields: [],
    usage: [{ what: 'M.Sc batches', sql: METADATA_JSON('msc_batches', 'parentStream'), by: 'name' }],
  },
  {
    kind: 'table', key: 'mscBatches', table: 'msc_batches', group: 'profile', codeMaxLength: 100, hasMetadata: true,
    label: 'M.Sc Batches', noun: 'M.Sc batch',
    description: 'Academic batches and tenures.',
    fields: [
      { key: 'parentStream', label: 'Stream', type: 'master', masterKey: 'mscStreams', required: true },
      { key: 'validity', label: 'Academic tenure', type: 'text', maxLength: 50, required: true, placeholder: 'e.g. 2026–2028' },
    ],
    usage: [{ what: 'employee profiles', sql: PROFILE_JSON('courseBatch'), by: 'name' }],
  },
  {
    kind: 'table', key: 'phdEnrollment', table: 'phd_enrollments', group: 'profile', codeMaxLength: 100, hasMetadata: true,
    label: 'PhD Enrollment', noun: 'Enrollment source',
    description: 'Fellowship sources and enrollment types for PhD scholars.',
    fields: [{ key: 'category', label: 'Funding category', type: 'lookup', lookupType: 'funding_category' }],
    usage: [{ what: 'employee profiles', sql: PROFILE_JSON('enrolledThrough'), by: 'name' }],
  },

  // ---- Employee-form lists (lookup_values) ------------------------------------
  {
    kind: 'lookup', key: 'salutation', lookupType: 'salutation', group: 'lists',
    label: 'Salutations', noun: 'Salutation', description: 'Shown before names (Mr., Dr., …).',
    fields: [],
    usage: [{ what: 'employee profiles', sql: PROFILE_COLUMN('suffix'), by: 'code' }],
  },
  {
    kind: 'lookup', key: 'gender', lookupType: 'gender', group: 'lists',
    label: 'Genders', noun: 'Gender', description: 'Gender options on the employee form.',
    fields: [],
    usage: [{ what: 'employee profiles', sql: PROFILE_JSON('gender'), by: 'code' }],
  },
  {
    kind: 'lookup', key: 'employeeType', lookupType: 'employee_type', group: 'lists',
    label: 'Employee Types', noun: 'Employee type',
    description: 'Each type uses one form layout, which decides the fields asked for.',
    fields: [{ key: 'formLayout', label: 'Form layout', type: 'layout', required: true }],
    usage: [
      { what: 'employee profiles', sql: PROFILE_COLUMN('employment_type'), by: 'code' },
      { what: 'designations', sql: METADATA_JSON('designations', 'empType'), by: 'code' },
    ],
  },
  {
    kind: 'lookup', key: 'orgUnitType', lookupType: 'org_unit_type', group: 'lists',
    label: 'Organization Unit Types', noun: 'Unit type', description: 'Types used in the Organizations master.',
    fields: [],
    usage: [{ what: 'organization units', sql: 'SELECT COUNT(*) AS n FROM organization_units WHERE type = ?', by: 'code' }],
  },
  {
    kind: 'lookup', key: 'cadreGroup', lookupType: 'cadre_group', group: 'lists',
    label: 'Cadre Groups', noun: 'Cadre group', description: 'Groups used in the Employee Categories master.',
    fields: [],
    usage: [{ what: 'employee categories', sql: METADATA_JSON('categories', 'group'), by: 'code' }],
  },
  {
    kind: 'lookup', key: 'fundingCategory', lookupType: 'funding_category', group: 'lists',
    label: 'Funding Categories', noun: 'Funding category', description: 'Categories used in the PhD Enrollment master.',
    fields: [],
    usage: [{ what: 'PhD enrollment sources', sql: METADATA_JSON('phd_enrollments', 'category'), by: 'code' }],
  },
];

export function findMaster(key: string): MasterDef | undefined {
  return MASTERS.find((m) => m.key === key);
}

/** Audit key for a master, e.g. "designation" or "lookup:gender". */
export function auditKey(def: MasterDef): string {
  if (def.kind === 'lookup') return `lookup:${def.lookupType}`;
  // Same key the old organization_unit_audit_logs rows were copied under.
  return def.key === 'organizations' ? 'organization_unit' : def.key;
}

/** Every audit key with a readable label, for the Audit Trail filter. */
export function auditMasterLabels(): Record<string, string> {
  const labels: Record<string, string> = {
    shift: 'Shifts',
    biometric_machine: 'Biometric Machines',
    organization_settings: 'Organization Settings',
    notification_recipient: 'Email CC / BCC',
    email_settings: 'Email Sender & Server',
  };
  for (const def of MASTERS) labels[auditKey(def)] = def.label;
  return labels;
}

/** Where a record is referenced. Empty list = safe to delete or rename. */
export async function findUsage(def: MasterDef, record: { name: string; code: string }): Promise<{ what: string; count: number }[]> {
  const found: { what: string; count: number }[] = [];
  for (const check of def.usage) {
    const [rows] = await pool.query<RowDataPacket[]>(check.sql, [check.by === 'code' ? record.code : record.name]);
    const count = Number(rows[0]?.n ?? 0);
    if (count > 0) found.push({ what: check.what, count });
  }
  return found;
}

export function describeUsage(usage: { what: string; count: number }[]): string {
  return usage.map((u) => `${u.count} ${u.what}`).join(', ');
}
