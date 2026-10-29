import { ApiError, api } from '../../../shared/services/api';
import type { User } from '../../../shared/types/auth.types';

/** Client for /api/hrms/employees. The server validates everything; this only shapes requests. */

export interface EmployeeRow {
  id: string;
  biometricId: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  validUpto: string | null;
  suffix: string | null;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  joiningDate: string | null;
  phone: string | null;
  officeLocation: string | null;
  shiftId: string | null;
  profileData: string;
  moduleRoles: Record<string, string[]>;
  role: User['role'];
  roles: User['role'][];
}

/** Result of a save, ready for the form: a message and, on failure, field-level errors. */
export interface SaveResult {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  user?: User;
}

/** Only the fields the employee form owns are sent; the server ignores anything else anyway. */
export function employeePayload(user: Partial<User>): Record<string, unknown> {
  return {
    biometricId: user.biometricId,
    suffix: user.suffix,
    name: user.name,
    email: user.email,
    gender: user.gender,
    dob: user.dob,
    phone: user.phone,
    employmentType: user.employmentType,
    shiftId: user.shiftId,
    leaveCycle: user.leaveCycle,
    joiningDate: user.joiningDate,
    officeLocation: user.officeLocation,
    department: user.department,
    designation: user.designation,
    employeeCategory: user.employeeCategory,
    permanentEmploymentType: (user as { permanentEmploymentType?: string }).permanentEmploymentType,
    reportingManagerId: user.reportingManagerId,
    reviewingManagerId: user.reviewingManagerId,
    hodName: user.hodName,
    validUntilDate: user.validUntilDate,
    isOnProbation: Boolean(user.isOnProbation),
    probationEndDate: user.probationEndDate,
    isPhDEnrolled: Boolean(user.isPhDEnrolled),
    piName: user.piName,
    courseProgram: user.courseProgram,
    courseBatch: user.courseBatch,
    enrolledThrough: (user as { enrolledThrough?: string }).enrolledThrough,
    guideSupervisor: user.guideSupervisor,
  };
}

/** Readable names for server field keys, used in the summary message. */
export const EMPLOYEE_FIELD_LABELS: Record<string, string> = {
  biometricId: 'Biometric ID', suffix: 'Salutation', name: 'Full name', email: 'Email', gender: 'Gender', dob: 'Date of birth',
  phone: 'Mobile number', employmentType: 'Employee type', shiftId: 'Shift', leaveCycle: 'Leave year type',
  joiningDate: 'Date of joining', officeLocation: 'Office location', department: 'Department / project',
  designation: 'Designation', employeeCategory: 'Category', permanentEmploymentType: 'Direct / Deputation',
  reportingManagerId: 'Reporting manager', reviewingManagerId: 'HoD', validUntilDate: 'Valid up to',
  probationEndDate: 'Probation end date', courseProgram: 'Course', courseBatch: 'Batch', enrolledThrough: 'Enrolled through',
  piName: 'PI name', guideSupervisor: 'Guide / supervisor',
};

export function describeFieldErrors(details?: Record<string, string>): string {
  const entries = Object.entries(details ?? {}).filter(([, msg]) => msg);
  if (!entries.length) return '';
  return entries.slice(0, 3).map(([key, msg]) => `${EMPLOYEE_FIELD_LABELS[key] ?? key}: ${msg}`).join(' · ')
    + (entries.length > 3 ? ` (+${entries.length - 3} more)` : '');
}

export function toSaveError(error: unknown, fallback: string): SaveResult {
  if (error instanceof ApiError) {
    const summary = describeFieldErrors(error.details);
    return { success: false, message: summary ? `${error.message} ${summary}` : error.message, fieldErrors: error.details };
  }
  return { success: false, message: fallback };
}

export const employeeApi = {
  list: () => api<EmployeeRow[]>('/hrms/employees', { passive: true }),
  create: (user: Partial<User>) =>
    api<{ employee: EmployeeRow; message: string }>('/hrms/employees', { method: 'POST', body: employeePayload(user) }),
  update: (id: string, user: Partial<User>) =>
    api<{ employee: EmployeeRow; changed: string[]; message: string }>(`/hrms/employees/${encodeURIComponent(id)}`, { method: 'PUT', body: employeePayload(user) }),
  /** effectiveDate is optional; the server uses today's date in India when it is missing. */
  setStatus: (id: string, status: 'active' | 'inactive', reason: string, effectiveDate?: string) =>
    api<{ employee: EmployeeRow; message: string }>(`/hrms/employees/${encodeURIComponent(id)}/status`, {
      method: 'PATCH', body: { status, reason, ...(effectiveDate ? { effectiveDate } : {}) },
    }),
  remove: (id: string, reason: string, reference: string) =>
    api<{ message: string }>(`/hrms/employees/${encodeURIComponent(id)}`, { method: 'DELETE', body: { reason, reference } }),
};
