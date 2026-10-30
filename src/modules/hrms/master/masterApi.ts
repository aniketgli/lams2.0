import { api } from '../../../shared/services/api';

/** Client for /api/hrms/masters and the shift / biometric / organization settings endpoints. */

export type MasterStatus = 'ACTIVE' | 'INACTIVE';

export interface MasterFieldDef {
  key: string;
  label: string;
  /** choice = one value of `choices`; multi = several values (of `choices` or a lookup), stored comma-separated. */
  type: 'text' | 'lookup' | 'master' | 'choice' | 'multi' | 'layout';
  required?: boolean;
  maxLength?: number;
  lookupType?: string;
  masterKey?: string;
  choices?: string[];
  placeholder?: string;
  /** Not shown in the master screen (kept as stored). */
  hidden?: boolean;
  /** For employee-type lookups: only types with one of these form layouts may be chosen. */
  allowedLayouts?: string[];
}

export interface MasterDefinition {
  key: string;
  label: string;
  noun: string;
  group: 'profile' | 'lists';
  description: string;
  kind: 'table' | 'lookup';
  /** For kind 'lookup': the list type other masters' fields refer to. */
  lookupType?: string;
  fields: MasterFieldDef[];
  /** Position among the Profile Masters tabs; null = no tab (data still used by other dropdowns). */
  tab?: number | null;
  /** Fixed set: records can be renamed or (de)activated, not added or deleted. */
  fixedRecords?: boolean;
}

export interface MasterCatalog {
  masters: MasterDefinition[];
  formLayouts: { code: string; name: string }[];
  auditMasters: Record<string, string>;
}

export interface MasterRecord {
  id: string;
  name: string;
  code: string;
  status: MasterStatus;
  sortOrder?: number;
  fields: Record<string, string>;
  updatedAt: string | null;
}

export interface MasterInput {
  name: string;
  code: string;
  status: MasterStatus;
  sortOrder?: number;
  fields: Record<string, string>;
  reason?: string;
}

/** Active values of every master, as used by form dropdowns. */
export type MasterOptions = Record<string, MasterRecord[]> & {
  shifts?: { id: string; code: string; name: string; isDefault: boolean }[];
};

export const masterApi = {
  catalog: () => api<MasterCatalog>('/hrms/masters/catalog'),
  options: () => api<MasterOptions>('/hrms/masters/options'),
  list: (key: string) => api<{ records: MasterRecord[] }>(`/hrms/masters/${encodeURIComponent(key)}`).then((r) => r.records),
  create: (key: string, input: MasterInput) =>
    api<{ record: MasterRecord }>(`/hrms/masters/${encodeURIComponent(key)}`, { method: 'POST', body: input }).then((r) => r.record),
  update: (key: string, id: string, input: MasterInput) =>
    api<{ record: MasterRecord }>(`/hrms/masters/${encodeURIComponent(key)}/${encodeURIComponent(id)}`, { method: 'PUT', body: input }).then((r) => r.record),
  setStatus: (key: string, id: string, status: MasterStatus, reason?: string) =>
    api<{ record: MasterRecord }>(`/hrms/masters/${encodeURIComponent(key)}/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status, reason } }).then((r) => r.record),
  remove: (key: string, id: string, reason?: string) =>
    api(`/hrms/masters/${encodeURIComponent(key)}/${encodeURIComponent(id)}`, { method: 'DELETE', body: { reason } }),
};

// ---- Audit trail -------------------------------------------------------------

export interface AuditRow {
  id: string;
  master: string;
  recordId: string;
  recordLabel: string | null;
  action: 'CREATE' | 'UPDATE' | 'STATUS' | 'DELETE';
  changedFields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  actor: { biometricId: string | null; name: string | null; role: string | null };
  at: string | null;
}

export interface AuditQuery {
  master?: string;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function fetchAudit(query: AuditQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '' && value !== null) params.set(key, String(value));
  }
  return api<{ total: number; page: number; pageSize: number; rows: AuditRow[] }>(`/hrms/masters/audit?${params.toString()}`);
}

// ---- Shifts ------------------------------------------------------------------

export interface ShiftRecord {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  gracePeriodMins: number;
  halfDayHours: number;
  fullDayHours: number;
  halfDayCutoffTime: string | null;
  description: string;
  applicableDays: string[];
  isDefault: boolean;
  status: 'active' | 'inactive';
}

export type ShiftInput = Omit<ShiftRecord, 'id'> & { reason?: string };

export const shiftApi = {
  list: () => api<ShiftRecord[]>('/hrms/shifts'),
  create: (input: ShiftInput) => api<ShiftRecord>('/hrms/shifts', { method: 'POST', body: input }),
  update: (id: string, input: ShiftInput) => api<ShiftRecord>(`/hrms/shifts/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
  remove: (id: string, reason?: string) => api(`/hrms/shifts/${encodeURIComponent(id)}`, { method: 'DELETE', body: { reason } }),
};

// ---- Biometric machines -------------------------------------------------------

export type MachinePurpose = 'ATTENDANCE' | 'ACCESS' | 'BOTH';

export interface MachineRecord {
  id: string;
  fullName: string;
  shortName: string;
  serialNumber: string;
  ipAddress: string;
  status: MasterStatus;
  purpose: MachinePurpose;
  countsForAttendance: boolean;
  updatedAt: string | null;
}

export type MachineInput = Omit<MachineRecord, 'countsForAttendance' | 'updatedAt'> & { reason?: string };

export const machineApi = {
  list: () => api<MachineRecord[]>('/hrms/biometric-machines'),
  create: (input: MachineInput) => api<MachineRecord>('/hrms/biometric-machines', { method: 'POST', body: input }),
  update: (id: string, input: MachineInput) => api<MachineRecord>(`/hrms/biometric-machines/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
  setStatus: (id: string, status: MasterStatus, reason?: string) =>
    api<MachineRecord>(`/hrms/biometric-machines/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status, reason } }),
  remove: (id: string, reason?: string) => api(`/hrms/biometric-machines/${encodeURIComponent(id)}`, { method: 'DELETE', body: { reason } }),
};

// ---- Organization settings -----------------------------------------------------

export interface OrganizationSettings {
  orgName: string;
  logoData: string;
  address: string;
  copyrightText: string;
  updatedAt: string | null;
}

export const organizationApi = {
  get: () => api<OrganizationSettings | null>('/hrms/organization'),
  save: (input: Omit<OrganizationSettings, 'updatedAt'> & { reason?: string }) =>
    api<OrganizationSettings>('/hrms/organization', { method: 'PUT', body: input }),
};

/** Tells the rest of the app (AppContext, open forms) that master data changed. */
export const MASTERS_CHANGED_EVENT = 'hrms:masters-changed';
export function announceMastersChanged() {
  window.dispatchEvent(new Event(MASTERS_CHANGED_EVENT));
}

// ---- Notification CC / BCC recipients -------------------------------------------

export type RecipientType = 'CC' | 'BCC';

export interface NotificationRecipient {
  id: string;
  type: RecipientType;
  email: string;
  name: string;
  status: MasterStatus;
  updatedAt: string | null;
}

export type RecipientInput = Omit<NotificationRecipient, 'id' | 'updatedAt'> & { reason?: string };

const RECIPIENTS = '/hrms/organization/notification-recipients';
export const recipientApi = {
  list: () => api<NotificationRecipient[]>(RECIPIENTS),
  create: (input: RecipientInput) => api<NotificationRecipient>(RECIPIENTS, { method: 'POST', body: input }),
  update: (id: string, input: RecipientInput) => api<NotificationRecipient>(`${RECIPIENTS}/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
  remove: (id: string, reason?: string) => api(`${RECIPIENTS}/${encodeURIComponent(id)}`, { method: 'DELETE', body: { reason } }),
};

// ---- Email sender & SMTP server ------------------------------------------------

export type SmtpSecurity = 'none' | 'starttls' | 'ssl';

export interface EmailSettings {
  /** 'database' once saved here; 'env' while still using the .env values; 'none' if neither. */
  source: 'database' | 'env' | 'none';
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  user: string;
  hasPassword: boolean;
  updatedAt: string | null;
}

export interface EmailSettingsInput {
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  user: string;
  /** Leave empty to keep the saved password. */
  password: string;
  clearPassword?: boolean;
  reason?: string;
}

export const emailSettingsApi = {
  get: () => api<EmailSettings>('/hrms/organization/email-settings'),
  save: (input: EmailSettingsInput) => api<EmailSettings>('/hrms/organization/email-settings', { method: 'PUT', body: input }),
  test: () => api<{ success: boolean; message: string }>('/hrms/organization/email-settings/test', { method: 'POST' }),
};

/** Default password for new employees. The password itself is never returned, only whether one is set. */
export interface DefaultPasswordStatus {
  isSet: boolean;
  source: 'settings' | 'env' | null;
  updatedAt: string | null;
  updatedBy: { biometricId: string; name: string | null } | null;
  rules: string;
}

export const defaultPasswordApi = {
  get: () => api<DefaultPasswordStatus>('/hrms/organization/default-password'),
  save: (password: string, confirmPassword: string) =>
    api<DefaultPasswordStatus & { message: string }>('/hrms/organization/default-password', { method: 'PUT', body: { password, confirmPassword } }),
};
