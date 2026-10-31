import { ApiError, api } from '../../../shared/services/api';
import { PrintableTable, activityEndpoints, downloadCsv } from '../../../shared/services/activityApi';
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
  institute: string | null;
  shiftId: string | null;
  profileData: string;
  moduleRoles: Record<string, string[]>;
  role: User['role'];
  roles: User['role'][];
  photoUrl: string | null;
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
    leaveGroup: user.leaveGroup,
    joiningDate: user.joiningDate,
    institute: user.institute,
    department: user.department,
    designation: user.designation,
    employeeCategory: user.employeeCategory,
    permanentEmploymentType: (user as { permanentEmploymentType?: string }).permanentEmploymentType,
    reportingManagerId: user.reportingManagerId,
    reviewingManagerId: user.reviewingManagerId,
    hodName: user.hodName,
    validUntilDate: user.validUntilDate,
    isOnProbation: Boolean(user.isOnProbation),
    isPwd: Boolean(user.isPwd),
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
  biometricId: 'Biometric ID', suffix: 'Salutation', name: 'Full name', email: 'Email', gender: 'Gender', isPwd: 'Person with disability', dob: 'Date of birth',
  phone: 'Mobile number', employmentType: 'Employee type', shiftId: 'Shift', leaveGroup: 'Leave group',
  joiningDate: 'Date of joining', institute: 'Organization', department: 'Department / project',
  designation: 'Designation', employeeCategory: 'Cadre', permanentEmploymentType: 'Category',
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

/** The signed-in employee's own profile, laid out by the server for their employee type. */
export interface ProfileField { key: string; label: string; value: string | null; kind?: 'text' | 'date' | 'email' | 'phone' }
export interface ProfileSection { id: string; title: string; fields: ProfileField[] }
export interface CareerEntry {
  id: string;
  title: string;
  organisation: string | null;
  details: string[];
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  validUpto: string | null;
  remarks: string | null;
  source: 'history' | 'current';
}

export interface MyProfile {
  biometricId: string;
  salutation: string | null;
  name: string;
  headline: string | null;
  subline: string | null;
  employeeType: { code: string | null; label: string | null; layout: string | null };
  status: 'active' | 'inactive';
  joiningDate: string | null;
  photoUrl: string | null;
  roles: string[];
  sections: ProfileSection[];
  career: CareerEntry[];
}

export const myProfileApi = {
  get: () => api<MyProfile>('/hrms/me/profile'),
  /** `image` is a data: URL (JPEG / PNG / WebP, at most 512 KB). */
  savePhoto: (image: string) => api<{ photoUrl: string; message: string }>('/hrms/me/photo', { method: 'PUT', body: { image } }),
  deletePhoto: () => api<{ photoUrl: null; message: string }>('/hrms/me/photo', { method: 'DELETE' }),
};

/** Another employee's profile (server checks the viewer may see it) and administrator photo changes. */
export const employeeProfileApi = {
  get: (userId: string) => api<MyProfile>(`/hrms/employees/${encodeURIComponent(userId)}/profile`),
  savePhoto: (biometricId: string, image: string) =>
    api<{ photoUrl: string; message: string }>(`/hrms/employees/${encodeURIComponent(biometricId)}/photo`, { method: 'PUT', body: { image } }),
  deletePhoto: (biometricId: string) =>
    api<{ photoUrl: null; message: string }>(`/hrms/employees/${encodeURIComponent(biometricId)}/photo`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Auditor: downloads and activity log
// ---------------------------------------------------------------------------

export type { ActivityQuery, ActivityRow, PrintableTable } from '../../../shared/services/activityApi';

const employeeActivity = activityEndpoints('/hrms/employees/activity', 'WII_Employee_Activity.csv');

export const auditorApi = {
  /** Rows for the PDF; the server logs the download. */
  directoryForPdf: () => api<PrintableTable>('/hrms/employees/export-pdf'),
  activityForPdf: employeeActivity.forPdf,
  activity: employeeActivity.list,
  downloadDirectory: () => downloadCsv('/hrms/employees/export.csv', 'WII_Employee_Directory.csv'),
  downloadActivity: employeeActivity.downloadCsv,
};
