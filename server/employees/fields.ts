import { authConfig, normalizeLoginEmail } from '../config/auth.config';
import { PATTERNS, Validator } from '../lib/validate';
import { CADRES, RECRUITMENT_CATEGORIES } from './lists';

/**
 * The employee form, field by field, as the server understands it.
 *
 * parseEmployeeInput() checks shape and format only (required, dates, lengths).
 * Whether a value exists in a master, a shift is active or a manager is a real
 * account is checked against the database in references.ts.
 */

export const FORM_LAYOUT_CODES = [
  'permanent', 'contractual', 'researcher', 'diploma_trainee', 'bsc_msc_student', 'phd_student', 'intern',
] as const;
export type FormLayout = (typeof FORM_LAYOUT_CODES)[number];

/** Which master supplies a field's value (values are stored by name). */
export type MasterRef = 'organizations' | 'designations' | 'categories' | 'projects' | 'courses' | 'batches' | 'phdEnrollment' | 'departmentOrProject';

interface LayoutRules {
  department?: MasterRef;
  designation?: boolean;
  category?: boolean;
  course?: boolean;
  enrollment?: boolean;
  hod?: boolean;
  probation?: boolean;
  phdFlag?: boolean;
  piName?: boolean;
  guide?: boolean;
  /** 'always' | 'deputation' (permanent staff: only when on deputation). */
  validUntil: 'always' | 'deputation';
}

export { CADRES, RECRUITMENT_CATEGORIES } from './lists';

/** Layouts whose form asks for a designation (designations may be tied to one of these employee types). */
export const DESIGNATION_LAYOUTS: FormLayout[] = ['permanent', 'contractual', 'researcher'];

/** What each fixed form layout asks for. Mirrors the client form. */
export const LAYOUT_RULES: Record<FormLayout, LayoutRules> = {
  permanent: { department: 'organizations', designation: true, category: true, hod: true, probation: true, validUntil: 'deputation' },
  contractual: { department: 'organizations', designation: true, category: true, probation: true, validUntil: 'always' },
  researcher: { department: 'projects', designation: true, phdFlag: true, piName: true, validUntil: 'always' },
  diploma_trainee: { course: true, validUntil: 'always' },
  bsc_msc_student: { course: true, validUntil: 'always' },
  phd_student: { enrollment: true, phdFlag: true, guide: true, validUntil: 'always' },
  intern: { department: 'departmentOrProject', validUntil: 'always' },
};

export function isFormLayout(value: unknown): value is FormLayout {
  return typeof value === 'string' && (FORM_LAYOUT_CODES as readonly string[]).includes(value);
}

/** Everything the form can send, after format checks. Empty optional values are null. */
export interface EmployeeInput {
  biometricId: string;
  salutation: string;
  name: string;
  email: string;
  gender: string;
  dob: string;
  phone: string;
  employmentType: string;
  shiftId: string;
  /** Code of the employee's leave group (Leave Groups master); it decides the leave types and the leave year. */
  leaveGroup: string;
  joiningDate: string;
  /** Institute code (lookup 'institute'), e.g. WII or SACON. */
  institute: string;
  department: string | null;
  designation: string | null;
  employeeCategory: string | null;
  permanentEmploymentType: 'Direct' | 'Deputation' | null;
  reportingManagerId: string | null;
  reviewingManagerId: string | null;
  /** Legacy forms send the HoD's name; it is resolved to an account on the server. */
  hodName: string | null;
  validUntilDate: string | null;
  isOnProbation: boolean;
  /** Person with disability (PwD); decides the leave quota and special leave. */
  isPwd: boolean;
  probationEndDate: string | null;
  isPhDEnrolled: boolean;
  piName: string | null;
  courseProgram: string | null;
  courseBatch: string | null;
  enrolledThrough: string | null;
  guideSupervisor: string | null;
}

const NAME_PATTERN = /^[\p{L}][\p{L}\p{M} .'-]*$/u;
const ID_PATTERN = /^\d{1,20}$/;

/** Mobile numbers: digits with an optional leading +, spaces and hyphens are removed. */
export function normalizePhone(value: string): string | null {
  const compact = value.replace(/[\s-]/g, '');
  return /^\+?\d{10,15}$/.test(compact) ? compact : null;
}

/**
 * Superannuation date: the last day of the month in which the employee turns 60;
 * someone born on the 1st retires on the last day of the previous month.
 */
export function retirementDate(dob: string): string {
  const [y, m, d] = dob.split('-').map(Number);
  let year = y + 60;
  let month = m - 1; // 0-based
  if (d === 1) {
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  const last = new Date(Date.UTC(year, month + 1, 0));
  return last.toISOString().slice(0, 10);
}

function optionalId(v: Validator, field: string): string | null {
  const raw = v.raw(field);
  if (raw === undefined || raw === null || raw === '') return null;
  const value = String(raw).trim();
  if (!ID_PATTERN.test(value)) {
    v.errors[field] ||= 'Choose a person from the list.';
    return null;
  }
  return value;
}

/**
 * Format checks for the employee form. `layout` comes from the employee type
 * (looked up by the caller). Fields that do not belong to the layout are
 * dropped so stale values from a previous type are not kept.
 */
export function parseEmployeeInput(body: unknown, layout: FormLayout | null, today: string): EmployeeInput {
  const v = new Validator(body);
  const rules = layout ? LAYOUT_RULES[layout] : null;

  const biometricId = v.string('biometricId', { max: 4, pattern: PATTERNS.biometricId, patternMessage: 'Biometric ID must be exactly 4 digits.' });
  const salutation = v.string('suffix', { max: 10 });
  const name = v.string('name', { min: 2, max: 255, pattern: NAME_PATTERN, patternMessage: 'Use letters, spaces, dots, hyphens and apostrophes only.' }).replace(/\s+/g, ' ');
  const rawEmail = v.string('email', { max: 254 });
  const email = rawEmail ? normalizeLoginEmail(rawEmail) : null;
  if (rawEmail && !email) v.errors.email ||= `Use an official email address ending in ${authConfig.loginEmailDomains.map((d) => `@${d}`).join(' or ')}.`;
  const gender = v.string('gender', { max: 40 });
  const dob = v.date('dob');
  const rawPhone = v.string('phone', { max: 20 });
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) v.errors.phone ||= 'Enter a 10 to 15 digit mobile number.';
  const employmentType = v.string('employmentType', { max: 50 });
  if (employmentType && !layout) v.errors.employmentType ||= 'Choose an employee type from the list.';
  const shiftRaw = v.raw('shiftId');
  const shiftId = shiftRaw === undefined || shiftRaw === null || shiftRaw === '' ? '' : String(shiftRaw).trim();
  if (!shiftId) v.errors.shiftId ||= 'This field is required.';
  else if (!ID_PATTERN.test(shiftId)) v.errors.shiftId ||= 'Choose a shift from the list.';
  const leaveGroup = v.string('leaveGroup', { max: 20, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'Choose a leave group from the list.' });
  const joiningDate = v.date('joiningDate');
  const institute = v.string('institute', { max: 50 });

  if (dob && dob >= today) v.errors.dob ||= 'Date of birth must be in the past.';
  if (dob && joiningDate && joiningDate <= dob) v.errors.joiningDate ||= 'Date of joining must be after the date of birth.';

  const need = (field: string, wanted: boolean | undefined, max = 255): string | null => {
    if (!wanted) return null;
    return v.string(field, { max }) || null;
  };

  const department = rules?.department ? need('department', true) : null;
  const designation = need('designation', rules?.designation);
  const employeeCategory = rules?.category ? v.oneOf('employeeCategory', CADRES) : null;
  const courseProgram = need('courseProgram', rules?.course);
  const courseBatch = need('courseBatch', rules?.course);
  const enrolledThrough = need('enrolledThrough', rules?.enrollment);
  const permanentEmploymentType = layout === 'permanent' ? v.oneOf('permanentEmploymentType', RECRUITMENT_CATEGORIES) : null;

  const reportingManagerId = optionalId(v, 'reportingManagerId');
  if (layout && !reportingManagerId) v.errors.reportingManagerId ||= 'This field is required.';
  const reviewingManagerId = rules?.hod ? optionalId(v, 'reviewingManagerId') : null;
  const hodName = rules?.hod ? v.optionalString('hodName', { max: 255 }) : null;
  if (rules?.hod && !reviewingManagerId && !hodName) v.errors.reviewingManagerId ||= 'Choose the HoD.';

  const validUntilWanted = rules?.validUntil === 'always' || (rules?.validUntil === 'deputation' && permanentEmploymentType === 'Deputation');
  const validUntilDate = validUntilWanted ? v.date('validUntilDate') : null;
  if (validUntilDate && joiningDate && validUntilDate < joiningDate) v.errors.validUntilDate ||= 'Valid up to must be on or after the date of joining.';

  const isPwd = v.bool('isPwd');
  const isOnProbation = rules?.probation ? v.bool('isOnProbation') : false;
  const probationEndDate = isOnProbation ? v.date('probationEndDate') : null;
  if (probationEndDate && joiningDate && probationEndDate < joiningDate) v.errors.probationEndDate ||= 'Probation must end after the date of joining.';

  const isPhDEnrolled = rules?.phdFlag ? v.bool('isPhDEnrolled') : false;
  const piName = rules?.piName ? v.optionalString('piName', { max: 255 }) : null;
  const guideSupervisor = rules?.guide ? v.optionalString('guideSupervisor', { max: 255 }) : null;

  v.assert();

  return {
    biometricId, salutation, name, email: email!, gender, dob: dob!, phone: phone!, employmentType, shiftId,
    leaveGroup, joiningDate: joiningDate!, institute, department, designation, employeeCategory,
    permanentEmploymentType, reportingManagerId, reviewingManagerId, hodName, validUntilDate, isOnProbation, isPwd,
    probationEndDate, isPhDEnrolled, piName, courseProgram, courseBatch, enrolledThrough, guideSupervisor,
  };
}

/** Account validity: retirement for permanent direct recruits, otherwise the date entered. */
export function accountValidUpto(input: EmployeeInput, layout: FormLayout): string {
  if (layout === 'permanent' && input.permanentEmploymentType !== 'Deputation') return retirementDate(input.dob);
  return input.validUntilDate!;
}

/** Keys of profile_data that come from the form. Anything else already stored there is kept. */
export const PROFILE_DATA_KEYS = [
  'gender', 'dob', 'leaveGroup', 'leaveCycle', 'leaveCycleBasis', 'employeeCategory', 'permanentEmploymentType',
  'reportingManagerId', 'reviewingManagerId', 'hodName', 'validUntilDate', 'isOnProbation', 'isPwd', 'probationEndDate',
  'isPhDEnrolled', 'piName', 'courseProgram', 'courseBatch', 'enrolledThrough', 'guideSupervisor', 'retirementDate',
] as const;

/** Keys never kept in profile_data (they live in real columns or must not be stored there). */
export const PROFILE_DATA_FORBIDDEN = new Set([
  'id', 'name', 'email', 'role', 'roles', 'baseRole', 'moduleRoles', 'biometricId', 'biometric_id', 'suffix',
  'department', 'designation', 'employmentType', 'joiningDate', 'phone', 'officeLocation', 'institute', 'shiftId',
  'password', 'passwordHash', 'tempPassword', 'emergencyContactPhone', 'status',
]);
