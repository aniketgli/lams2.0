import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { ROLE_LABELS } from '../lib/roles';
import { FormLayout, isFormLayout, retirementDate } from './fields';
import { photoUrls } from './photos';
import { EmployeeRecord, Viewer, getEmployee } from './store';

/**
 * The signed-in employee's own profile, laid out for their employee type.
 * The server decides which fields belong to which type (the same rules as the
 * employee form), resolves IDs to names, and sends ready-to-show sections, so
 * the screen never guesses or shows placeholder values.
 */

export type FieldKind = 'text' | 'date' | 'email' | 'phone';
export interface ProfileField { key: string; label: string; value: string | null; kind?: FieldKind }
export interface ProfileSection { id: string; title: string; fields: ProfileField[] }

export interface MyProfile {
  biometricId: string;
  salutation: string | null;
  name: string;
  /** Designation, or the course for students. */
  headline: string | null;
  /** Department / project / batch line under the headline. */
  subline: string | null;
  employeeType: { code: string | null; label: string | null; layout: FormLayout | null };
  status: 'active' | 'inactive';
  joiningDate: string | null;
  photoUrl: string | null;
  roles: string[];
  sections: ProfileSection[];
  /** Appointment history / career, newest first. Always has the current appointment when a joining date exists. */
  career: CareerEntry[];
}

export interface CareerEntry {
  id: string;
  title: string;
  organisation: string | null;
  details: string[];
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  /** For fixed-term appointments: when the current one ends. */
  validUpto: string | null;
  remarks: string | null;
  /** 'history' = a posting record; 'current' = the present appointment from the profile itself. */
  source: 'history' | 'current';
}

async function rows(sql: string, params: unknown[]): Promise<RowDataPacket[]> {
  const [result] = await pool.query<RowDataPacket[]>(sql, params);
  return result;
}

function dateOnly(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

async function employeeType(code: string | null): Promise<{ label: string | null; layout: FormLayout | null }> {
  if (!code) return { label: null, layout: null };
  // Inactive types still describe existing employees, so status is not filtered here.
  const [row] = await rows("SELECT name, metadata FROM lookup_values WHERE lookup_type = 'employee_type' AND code = ? LIMIT 1", [code]);
  if (!row) return { label: code, layout: isFormLayout(code) ? code : null };
  let layout: FormLayout | null = null;
  try {
    const parsed = JSON.parse(String(row.metadata || '{}'))?.formLayout;
    layout = isFormLayout(parsed) ? parsed : null;
  } catch {
    layout = null;
  }
  return { label: text(row.name), layout };
}

async function instituteName(code: string | null): Promise<string | null> {
  if (!code) return null;
  const [row] = await rows("SELECT name FROM lookup_values WHERE lookup_type = 'institute' AND code = ? LIMIT 1", [code]);
  return row ? text(row.name) : code;
}

async function shiftLabel(shiftId: string | null): Promise<string | null> {
  if (!shiftId || !/^\d+$/.test(shiftId)) return null;
  const [row] = await rows('SELECT name, start_time, end_time FROM shifts WHERE id = ? LIMIT 1', [Number(shiftId)]);
  if (!row) return null;
  const time = (v: unknown) => String(v ?? '').slice(0, 5);
  return `${row.name} (${time(row.start_time)} – ${time(row.end_time)})`;
}

async function personName(id: unknown): Promise<string | null> {
  const value = text(id);
  if (!value || !/^\d+$/.test(value)) return null;
  const [row] = await rows('SELECT name, biometric_id FROM users WHERE id = ? LIMIT 1', [Number(value)]);
  return row ? `${row.name} (B.I. ${row.biometric_id})` : null;
}

const LEAVE_YEAR: Record<string, string> = { CY: 'Calendar year (Jan – Dec)', FY: 'Financial year (Apr – Mar)' };

function yesNo(value: unknown): string {
  return value === true || value === 'true' || value === 1 ? 'Yes' : 'No';
}

/** Builds the sections for one employee. Exported for tests. */
export function buildSections(
  record: EmployeeRecord,
  data: Record<string, unknown>,
  layout: FormLayout | null,
  resolved: { typeLabel: string | null; shift: string | null; reportingManager: string | null; hod: string | null; institute?: string | null },
): ProfileSection[] {
  const f = (key: string, label: string, value: unknown, kind: FieldKind = 'text'): ProfileField =>
    ({ key, label, value: kind === 'date' ? dateOnly(value) : text(value), kind });

  const personal: ProfileSection = {
    id: 'personal',
    title: 'Personal details',
    fields: [
      f('biometricId', 'Biometric ID', record.biometricId),
      f('gender', 'Gender', data.gender),
      f('dob', 'Date of birth', data.dob, 'date'),
      f('email', 'Official email', record.email, 'email'),
      f('phone', 'Mobile number', record.phone, 'phone'),
    ],
  };

  const work: ProfileField[] = [f('employeeType', 'Employee type', resolved.typeLabel)];
  const reporting: ProfileField[] = [];
  const validUpto = f('validUpto', 'Valid up to', record.validUpto, 'date');

  switch (layout) {
    case 'permanent': {
      const deputation = data.permanentEmploymentType === 'Deputation';
      work.push(
        f('department', 'Department / Section / Cell', record.department),
        f('designation', 'Designation', record.designation),
        f('employeeCategory', 'Category', data.employeeCategory),
        f('permanentEmploymentType', 'Appointment', data.permanentEmploymentType),
        f('joiningDate', 'Date of joining', record.joiningDate, 'date'),
        deputation
          ? f('validUpto', 'Deputation valid up to', record.validUpto, 'date')
          : f('retirementDate', 'Superannuation date', data.retirementDate ?? (data.dob ? retirementDate(String(data.dob)) : null), 'date'),
        f('probation', 'Probation', data.isOnProbation
          ? `On probation${data.probationEndDate ? ` until ${dateOnly(data.probationEndDate)}` : ''}`
          : data.dob ? 'Confirmed' : null), // unknown until the profile form has been saved
      );
      reporting.push(f('reportingManager', 'Reporting manager (L1)', resolved.reportingManager), f('hod', 'Head of department (L2)', resolved.hod));
      break;
    }
    case 'contractual':
      work.push(
        f('department', 'Department / Section / Cell', record.department),
        f('designation', 'Designation', record.designation),
        f('employeeCategory', 'Category', data.employeeCategory),
        f('joiningDate', 'Date of joining', record.joiningDate, 'date'),
        { ...validUpto, label: 'Contract valid up to' },
        f('probation', 'Probation', data.isOnProbation
          ? `On probation${data.probationEndDate ? ` until ${dateOnly(data.probationEndDate)}` : ''}`
          : data.dob ? 'Confirmed' : null), // unknown until the profile form has been saved
      );
      reporting.push(f('reportingManager', 'Reporting manager', resolved.reportingManager));
      break;
    case 'researcher':
      work.push(
        f('department', 'Project', record.department),
        f('designation', 'Designation', record.designation),
        f('isPhDEnrolled', 'Enrolled for PhD', yesNo(data.isPhDEnrolled)),
        f('joiningDate', 'Date of joining', record.joiningDate, 'date'),
        { ...validUpto, label: 'Project tenure up to' },
      );
      reporting.push(f('reportingManager', 'Principal investigator / Reporting manager', resolved.reportingManager), f('piName', 'PI (as recorded)', data.piName));
      break;
    case 'diploma_trainee':
    case 'bsc_msc_student':
      work.push(
        f('courseProgram', 'Course', data.courseProgram),
        f('courseBatch', 'Batch', data.courseBatch),
        f('joiningDate', 'Date of joining', record.joiningDate, 'date'),
        { ...validUpto, label: 'Course valid up to' },
      );
      reporting.push(f('reportingManager', 'Course coordinator / Reporting manager', resolved.reportingManager));
      break;
    case 'phd_student':
      work.push(
        f('enrolledThrough', 'Enrolled through', data.enrolledThrough),
        f('joiningDate', 'Date of joining', record.joiningDate, 'date'),
        { ...validUpto, label: 'Registration valid up to' },
      );
      reporting.push(f('guideSupervisor', 'Guide / Supervisor', data.guideSupervisor), f('reportingManager', 'Reporting manager', resolved.reportingManager));
      break;
    case 'intern':
      work.push(
        f('department', 'Project / Department / Section', record.department),
        f('joiningDate', 'Date of joining', record.joiningDate, 'date'),
        { ...validUpto, label: 'Internship up to' },
      );
      reporting.push(f('reportingManager', 'Supervisor / Reporting manager', resolved.reportingManager));
      break;
    default:
      work.push(
        f('department', 'Department', record.department),
        f('designation', 'Designation', record.designation),
        f('joiningDate', 'Date of joining', record.joiningDate, 'date'),
        validUpto,
      );
      reporting.push(f('reportingManager', 'Reporting manager', resolved.reportingManager));
  }

  const attendance: ProfileField[] = [
    f('shift', 'Work shift', resolved.shift),
    f('leaveCycle', 'Leave year', LEAVE_YEAR[String(data.leaveCycle ?? '')] ?? null),
  ];
  // Shown in place of the old free-text office location.
  attendance.push(f('institute', 'Organization', resolved.institute));

  return [
    personal,
    { id: 'work', title: layout === 'diploma_trainee' || layout === 'bsc_msc_student' || layout === 'phd_student' || layout === 'intern' ? 'Programme details' : 'Employment details', fields: work },
    { id: 'reporting', title: 'Reporting', fields: reporting },
    { id: 'attendance', title: 'Attendance & leave', fields: attendance },
  ];
}

/**
 * Career timeline: posting records from user_histories, plus the present
 * appointment taken from the profile when no record covers it. Exported for tests.
 */
export function buildCareer(
  record: EmployeeRecord,
  data: Record<string, unknown>,
  type: { label: string | null; layout: FormLayout | null },
  historyRows: RowDataPacket[],
): CareerEntry[] {
  const entries: CareerEntry[] = historyRows.map((r) => ({
    id: `h${r.id}`,
    title: text(r.role_in_project) ?? text(r.project_name) ?? 'Posting',
    organisation: text(r.department),
    details: [
      text(r.project_name) && text(r.project_name) !== text(r.role_in_project) ? `Project: ${text(r.project_name)}` : null,
      text(r.pi_name) ? `PI: ${text(r.pi_name)}` : null,
    ].filter((x): x is string => Boolean(x)),
    startDate: dateOnly(r.start_date),
    endDate: dateOnly(r.end_date),
    isCurrent: Boolean(r.is_ongoing),
    validUpto: null,
    remarks: text(r.remarks),
    source: 'history' as const,
  }));

  if (record.joiningDate && !entries.some((e) => e.isCurrent)) {
    const student = type.layout === 'diploma_trainee' || type.layout === 'bsc_msc_student';
    const title = student ? text(data.courseProgram) : type.layout === 'phd_student' ? 'PhD Scholar' : record.designation;
    const permanentDirect = type.layout === 'permanent' && data.permanentEmploymentType !== 'Deputation';
    entries.unshift({
      id: 'current',
      title: title ?? type.label ?? 'Appointment',
      organisation: student ? text(data.courseBatch) : record.department,
      details: [
        type.label,
        type.layout === 'permanent' ? text(data.permanentEmploymentType) : null,
        type.layout === 'permanent' || type.layout === 'contractual' ? text(data.employeeCategory) : null,
      ].filter((x): x is string => Boolean(x)),
      startDate: record.joiningDate,
      endDate: null,
      isCurrent: record.status === 'active',
      validUpto: permanentDirect ? null : record.validUpto,
      remarks: data.isOnProbation
        ? `On probation${data.probationEndDate ? ` until ${dateOnly(data.probationEndDate)}` : ''}`
        : null,
      source: 'current',
    });
  }
  return entries;
}

export async function getMyProfile(viewer: Viewer): Promise<MyProfile> {
  const record = await getEmployee(viewer, viewer.id);
  let data: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(record.profileData || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
  } catch {
    data = {};
  }

  const type = await employeeType(record.employmentType);
  const [shift, reportingManager, hod, photos, historyRows, institute] = await Promise.all([
    shiftLabel(record.shiftId),
    personName(data.reportingManagerId),
    personName(data.reviewingManagerId),
    photoUrls([record.biometricId]),
    rows(`SELECT id, project_name, role_in_project, department, pi_name, start_date, end_date, is_ongoing, remarks
            FROM user_histories WHERE biometric_id = ? ORDER BY is_ongoing DESC, start_date DESC LIMIT 50`, [record.biometricId])
      .catch((error) => { if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') return [] as RowDataPacket[]; throw error; }),
    instituteName(record.institute),
  ]);

  const student = type.layout === 'diploma_trainee' || type.layout === 'bsc_msc_student';
  return {
    biometricId: record.biometricId,
    salutation: record.suffix,
    name: record.name,
    headline: student ? text(data.courseProgram) : type.layout === 'phd_student' ? 'PhD Scholar' : record.designation,
    subline: student ? text(data.courseBatch) : record.department,
    employeeType: { code: record.employmentType, label: type.label, layout: type.layout },
    status: record.status,
    joiningDate: record.joiningDate,
    photoUrl: photos.get(record.biometricId) ?? null,
    roles: [...new Set(record.roles.map((r) => ROLE_LABELS[r]))],
    sections: buildSections(record, data, type.layout, { typeLabel: type.label, shift, reportingManager, hod, institute }),
    career: buildCareer(record, data, type, historyRows),
  };
}
