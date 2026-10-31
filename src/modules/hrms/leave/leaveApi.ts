import { api } from '../../../shared/services/api';

export type LeaveStages = 1 | 2;
export type LeaveAccrual = 'yearly' | 'half_yearly' | 'quarterly' | 'monthly' | 'upfront';

export interface LeaveTypeRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  defaultQuota: number;
  pwdQuota: number | null;
  pwdOnly: boolean;
  accrual: LeaveAccrual;
  maxAccumulation: number;
  carryForward: boolean;
  maxCarryForward: number;
  encashmentAllowed: boolean;
  approvalStages: LeaveStages;
  minNoticeDays: number;
  halfDayAllowed: boolean;
  medicalCertDays: number;
  sandwichRule: 'excluded' | 'included';
  combineWith: 'none' | 'single' | 'double' | 'both';
  employeeTypes: string[];
  gender: 'all' | 'female_only' | 'male_only';
  minServiceMonths: number;
  maxConsecutiveDays: number;
  isDebited: boolean;
  isPaid: boolean;
  joiningRequired: boolean;
  afterExhaustedTypeId: string;
  debitFromTypeId: string;
  debitFactor: number;
  lifetimeMax: number;
  maxSpellsPerYear: number;
  minDaysPerApplication: number;
  maxSpellsPerMonth: number;
  maxSpellsLifetime: number;
  quotas: Array<{ employeeType: string; quota: number }>;
  status: 'active' | 'inactive';
  updatedAt: string | null;
}

export type LeaveTypeInput = Omit<LeaveTypeRecord, 'id' | 'updatedAt'> & { reason?: string };

export interface LeaveTypeList {
  types: LeaveTypeRecord[];
  employeeTypes: Array<{ code: string; name: string }>;
}

export const leaveTypeApi = {
  list: () => api<LeaveTypeList>('/hrms/leave-types'),
  create: (input: LeaveTypeInput) => api<{ leaveType: LeaveTypeRecord; message: string }>('/hrms/leave-types', { method: 'POST', body: input }),
  update: (id: string, input: LeaveTypeInput) => api<{ leaveType: LeaveTypeRecord; message: string }>(`/hrms/leave-types/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
  remove: (id: string, reason?: string) => api<{ message: string }>(`/hrms/leave-types/${encodeURIComponent(id)}`, { method: 'DELETE', body: { reason } }),
};

// ---- Leave groups ---------------------------------------------------------------------------------

export interface LeaveGroupRecord {
  id: string;
  code: string;
  name: string;
  leaveYear: 'CY' | 'FY';
  leaveTypeIds: string[];
  leaves: Array<{ id: string; code: string; name: string }>;
  status: 'active' | 'inactive';
  employeeCount: number;
  updatedAt: string | null;
}

export type LeaveGroupInput = Pick<LeaveGroupRecord, 'code' | 'name' | 'leaveYear' | 'leaveTypeIds' | 'status'> & { reason?: string };

export interface LeaveGroupList {
  groups: LeaveGroupRecord[];
  leaveTypes: Array<{ id: string; code: string; name: string }>;
}

export const leaveGroupApi = {
  list: () => api<LeaveGroupList>('/hrms/leave-groups'),
  create: (input: LeaveGroupInput) => api<{ group: LeaveGroupRecord; message: string }>('/hrms/leave-groups', { method: 'POST', body: input }),
  update: (id: string, input: LeaveGroupInput) => api<{ group: LeaveGroupRecord; message: string }>(`/hrms/leave-groups/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
  remove: (id: string, reason?: string) => api<{ message: string }>(`/hrms/leave-groups/${encodeURIComponent(id)}`, { method: 'DELETE', body: { reason } }),
};

// ---- Leave requests -----------------------------------------------------------------------------

export type LeaveStatus = 'pending_l1' | 'pending_l2' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  startSession: 'full' | 'second_half';
  endSession: 'full' | 'first_half';
  daysCount: number;
  cycleYear: number;
  reason: string;
  certificate: boolean;
  stages: 1 | 2;
  status: LeaveStatus;
  appliedAt: string;
  appliedByName: string;
  managerName: string | null;
  reviewerName: string | null;
  forwardedByName: string | null;
  forwardedAt: string | null;
  forwardComment: string | null;
  actionByName: string | null;
  actionAt: string | null;
  comment: string | null;
  waitingFor: string | null;
  canDecide: boolean;
  decideStep: 'approve' | 'forward';
  canEdit: boolean;
  canDelete: boolean;
  canUndo: boolean;
}

export interface LeaveList {
  from: string;
  to: string;
  requests: LeaveRequest[];
  /** Employees an administrator can apply for (empty for everyone else). */
  employees: { id: string; biometricId: string; name: string; designation: string }[];
  types: LeaveTypeRecord[];
}

export interface LeaveInput {
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  startSession: 'full' | 'second_half';
  endSession: 'full' | 'first_half';
  reason: string;
  certificate: boolean;
}

export interface LeaveBalance { total: number; carryForward: number; used: number; pending: number; available: number }

export interface LeavePreview {
  days: number;
  cycleYear: number;
  cycle: string;
  balance: LeaveBalance | null;
  error: string | null;
}

export interface BalanceRow {
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  basis: 'CY' | 'FY';
  cycle: string;
  balances: Record<string, (LeaveBalance & { eligible: boolean }) | null>;
}

export interface BalanceList {
  year: number;
  /** Leave years that have data, newest first (always includes this year). */
  years: number[];
  types: Array<{ id: string; code: string; name: string; isDebited: boolean }>;
  rows: BalanceRow[];
}

export interface HistoryYear {
  year: number; cycleType: 'CY' | 'FY'; cycle: string;
  types: Array<{ code: string; name: string; isDebited: boolean; total: number; carryForward: number; used: number; pending: number; available: number }>;
}
export interface LeaveHistory { employee: { id: string; name: string; biometricId: string }; years: HistoryYear[] }
export type ImportStrategy = 'set' | 'add' | 'deduct';
export interface ImportRow {
  line: number; biometricId: string; employee: string; cycle: string; leaveCode: string; leaveType: string; value: string;
  before: number | null; after: number | null; status: 'ok' | 'unchanged' | 'error'; error: string | null;
}
export interface ImportReview {
  strategy: ImportStrategy;
  summary: { rows: number; ok: number; unchanged: number; errors: number };
  rows: ImportRow[];
}

const base = '/hrms/leave';
const one = (id: string) => `${base}/requests/${encodeURIComponent(id)}`;
const body = (i: LeaveInput) => ({ ...i, userId: i.userId || undefined });

export const leaveApi = {
  list: (from: string, to: string) => api<LeaveList>(`${base}/requests?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  create: (input: LeaveInput) => api<{ request: LeaveRequest; message: string }>(`${base}/requests`, { method: 'POST', body: body(input) }),
  update: (id: string, input: LeaveInput) => api<{ request: LeaveRequest; changed: string[]; message: string }>(one(id), { method: 'PUT', body: body(input) }),
  decide: (id: string, action: 'approve' | 'reject', comment: string) =>
    api<{ request: LeaveRequest; outcome: 'approved' | 'forwarded' | 'rejected'; message: string }>(`${one(id)}/decision`, { method: 'POST', body: { action, comment: comment || undefined } }),
  undo: (id: string, reason?: string) => api<{ request: LeaveRequest; message: string }>(`${one(id)}/undo`, { method: 'POST', body: { reason: reason || undefined } }),
  remove: (id: string, reason?: string) => api<{ message: string }>(one(id), { method: 'DELETE', body: { reason: reason || undefined } }),
  preview: (input: Pick<LeaveInput, 'userId' | 'leaveTypeId' | 'startDate' | 'endDate' | 'startSession' | 'endSession'>) => {
    const q = new URLSearchParams(Object.entries(input).filter(([, v]) => v) as [string, string][]);
    return api<LeavePreview>(`${base}/preview?${q.toString()}`);
  },
  balances: (year: number) => api<BalanceList>(`${base}/balances?year=${year}`),
  importTemplate: (year: number, cycle: 'CY' | 'FY') =>
    api<{ year: number; headers: string[]; rows: Array<Array<string | number>> }>(`${base}/balances/import/template?year=${year}&cycle=${cycle}`),
  history: (userId: string) => api<LeaveHistory>(`${base}/balances/history?userId=${encodeURIComponent(userId)}`),
  reviewImport: (input: { strategy: ImportStrategy; csv: string }) =>
    api<ImportReview>(`${base}/balances/import/review`, { method: 'POST', body: input }),
  applyImport: (input: { strategy: ImportStrategy; csv: string }) =>
    api<ImportReview & { message: string }>(`${base}/balances/import`, { method: 'POST', body: input }),
  setBalance: (input: { userId: string; leaveTypeId: string; year: number; total: number; carryForward: number; reason?: string }) =>
    api<{ balance: LeaveBalance; message: string }>(`${base}/balances`, { method: 'PUT', body: { ...input, reason: input.reason || undefined } }),
};
