import { api } from '../../../shared/services/api';
import { downloadCsv } from '../../../shared/services/activityApi';

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
  needsContact: boolean;
  ltcAllowed: boolean;
  prefixSuffix: boolean;
  /** HoD approval is needed only above this many days (0 = always, when the type has two steps). */
  hodAfterDays: number;
  /** A medical certificate is needed for every application. */
  certificateRequired: boolean;
  /** Only weekly offs and gazetted holidays can be chosen (station leave). */
  offDaysOnly: boolean;
  fitnessCertificate: boolean;
  /** Purposes the leave can be taken for (e.g. Special Casual Leave); the apply form asks for one when not empty. */
  purposes: string[];
  /** Rules the portal checks beyond these settings (Paternity, Maternity, CCL, LND, EOL, …). */
  specialRules: string[];
  quotas: Array<{ employeeType: string; quota: number }>;
  status: 'active' | 'inactive';
  updatedAt: string | null;
}

export type LeaveTypeInput = Omit<LeaveTypeRecord, 'id' | 'updatedAt' | 'specialRules'> & { reason?: string };

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
  certificateName: string | null;
  stationLeave: boolean;
  /** Set on a station leave applied automatically for the prefix / suffix of another leave request. */
  linkedTo: string | null;
  ltcType: 'none' | 'ltc' | 'ex_india';
  encashDays: number;
  contactAddress: string;
  /** Compensatory off: the worked weekly offs / holidays it uses, one per leave day. */
  compOffDates: string[];
  purpose: string | null;
  /** Paternity / Maternity Leave: birth, adoption or abortion / miscarriage ('loss'); Child Care Leave: 'care'. */
  childEvent: 'delivery' | 'adoption' | 'loss' | 'care' | null;
  childEventDate: string | null;
  childBirthDate: string | null;
  survivingChildren: number | null;
  /** Child Care Leave: 1 eldest / 2 second eldest child, child with a disability, single mother. */
  childOrder: 1 | 2 | null;
  childDisabled: boolean;
  singleParent: boolean;
  prefixFrom: string | null;
  prefixTo: string | null;
  suffixFrom: string | null;
  suffixTo: string | null;
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
  actionByRole: 'R.M.' | 'HoD' | 'Admin' | null;
  actionAt: string | null;
  comment: string | null;
  waitingFor: string | null;
  canDecide: boolean;
  decideStep: 'approve' | 'forward';
  canEdit: boolean;
  canDelete: boolean;
  canUndo: boolean;
  /** Joining report after a 2-stage leave. */
}

export interface LeaveList {
  from: string;
  to: string;
  requests: LeaveRequest[];
  /** Employees an administrator can apply for (empty for everyone else). */
  employees: { id: string; biometricId: string; name: string; designation: string; isPwd: boolean }[];
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
  /** Station (headquarters) permission: true when the employee will leave the station. */
  stationLeave: boolean;
  ltcType: 'none' | 'ltc' | 'ex_india';
  encashLtc: boolean;
  encashDays: number;
  contactAddress: string;
  /** Compensatory off: the weekly offs / holidays worked that this leave uses, one per leave day (YYYY-MM-DD). */
  compOffDates: string[];
  /** One of the leave type's purposes, when it has a list. */
  purpose: string;
  /** Paternity / Maternity / Child Care Leave only. */
  childEvent: '' | 'delivery' | 'adoption' | 'loss' | 'care';
  childEventDate: string;
  childBirthDate: string;
  survivingChildren: string;
  /** Child Care Leave: '1' eldest, '2' second eldest. */
  childOrder: string;
  childDisabled: boolean;
  singleParent: boolean;
  availPrefix: boolean;
  prefixFrom: string;
  prefixTo: string;
  availSuffix: boolean;
  suffixFrom: string;
  suffixTo: string;
  /** Medical certificate chosen in the form (a data URL); the server checks the real file type and size. */
  certificateFile?: { name: string; data: string } | null;
}

export interface CompOffCredit { date: string; in: string; out: string; hours: number; reason: string; validUntil: string }

export interface LeaveBalance { total: number; carryForward: number; used: number; pending: number; available: number; /** Set as on this date: leaves before it are already in the balance. */ asOf?: string | null }

export interface LeavePreview {
  days: number;
  cycleYear: number;
  cycle: string;
  balance: LeaveBalance | null;
  error: string | null;
  /** Weekly offs / gazetted holidays just before and after the leave that can be added to it. */
  prefix: HolidayBlock | null;
  suffix: HolidayBlock | null;
  /** Station permission can be asked for only when the leave is continuous with a weekend or holiday. */
  stationOk: boolean;
  /** The dates after the server moved them off leading / trailing weekly offs and holidays, and the dates that were asked for. */
  startDate: string;
  endDate: string;
  requestedStart: string;
  requestedEnd: string;
}

export interface HolidayBlock { from: string; to: string; days: number }

export interface BalanceRow {
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  employmentType: string;
  basis: 'CY' | 'FY';
  cycle: string;
  asOn: string;
  balances: Record<string, (LeaveBalance & { eligible: boolean }) | null>;
}

export interface BalanceList {
  year: number;
  /** Leave years that have data, newest first (always includes this year). */
  years: number[];
  employeeTypes: Array<{ code: string; name: string }>;
  types: Array<{ id: string; code: string; name: string; isDebited: boolean }>;
  rows: BalanceRow[];
}

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

export type JoiningStatus = 'pending_l1' | 'pending_l2' | 'approved' | 'rejected';
export interface JoiningReport {
  id: string;
  status: JoiningStatus;
  punchIn: string | null;
  session: 'AM' | 'PM' | null;
  submittedAt: string;
  submittedByName: string;
  managerName: string | null;
  reviewerName: string | null;
  forwardedByName: string | null;
  forwardedAt: string | null;
  forwardComment: string | null;
  actionByName: string | null;
  actionByRole: 'R.M.' | 'HoD' | 'Admin' | null;
  actionAt: string | null;
  comment: string | null;
  fitnessName: string | null;
  waitingFor: string | null;
}
export interface JoiningItem {
  requestId: string;
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  startSession: string;
  endSession: string;
  days: number;
  reason: string;
  contactAddress: string;
  stationLeave: boolean;
  ltcType: string;
  prefixFrom: string | null;
  prefixTo: string | null;
  suffixFrom: string | null;
  suffixTo: string | null;
  leaveStatus: string;
  fitnessAllowed: boolean;
  joiningDate: string;
  report: JoiningReport | null;
  canSubmit: boolean;
  canEdit: boolean;
  canDecide: boolean;
  decideStep: 'approve' | 'forward';
}
export interface JoiningFile { name: string; data: string }

const base = '/hrms/leave';
const one = (id: string) => `${base}/requests/${encodeURIComponent(id)}`;
const body = (i: LeaveInput) => ({ ...i, userId: i.userId || undefined, certificateFile: i.certificateFile || undefined });

export const leaveApi = {
  list: (from: string, to: string) => api<LeaveList>(`${base}/requests?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  create: (input: LeaveInput) => api<{ request: LeaveRequest; message: string }>(`${base}/requests`, { method: 'POST', body: body(input) }),
  update: (id: string, input: LeaveInput) => api<{ request: LeaveRequest; changed: string[]; message: string }>(one(id), { method: 'PUT', body: body(input) }),
  decide: (id: string, action: 'approve' | 'reject', comment: string) =>
    api<{ request: LeaveRequest; outcome: 'approved' | 'forwarded' | 'rejected'; message: string }>(`${one(id)}/decision`, { method: 'POST', body: { action, comment: comment || undefined } }),
  undo: (id: string, reason?: string) => api<{ request: LeaveRequest; message: string }>(`${one(id)}/undo`, { method: 'POST', body: { reason: reason || undefined } }),
  remove: (id: string, reason?: string) => api<{ message: string }>(one(id), { method: 'DELETE', body: { reason: reason || undefined } }),
  preview: (input: Pick<LeaveInput, 'userId' | 'leaveTypeId' | 'startDate' | 'endDate' | 'startSession' | 'endSession'> & { exceptId?: string }) => {
    const q = new URLSearchParams(Object.entries(input).filter(([, v]) => v) as [string, string][]);
    return api<LeavePreview>(`${base}/preview?${q.toString()}`);
  },
  downloadCertificate: (id: string) => downloadCsv(`${one(id)}/certificate`, 'medical-certificate'),
  occupied: (input: { userId: string; leaveTypeId: string; exceptId: string }) => {
    const q = new URLSearchParams(Object.entries(input).filter(([, v]) => v) as [string, string][]);
    return api<{ days: { date: string; status: 'pending' | 'approved' | 'rejected' }[]; joined: string[]; workdays: string[] }>(`${base}/occupied?${q.toString()}`);
  },
  /** Worked weekly offs / holidays that can be taken as a compensatory off now. */
  compOff: (input: { userId: string; exceptId?: string }) => {
    const q = new URLSearchParams(Object.entries(input).filter(([, v]) => v) as [string, string][]);
    return api<{ credits: CompOffCredit[] }>(`${base}/comp-off?${q.toString()}`);
  },
  /** Restricted holidays of the Holiday Calendar that can still be applied for. */
  restrictedHolidays: (input: { userId: string; exceptId?: string }) => {
    const q = new URLSearchParams(Object.entries(input).filter(([, v]) => v) as [string, string][]);
    return api<{ holidays: Array<{ date: string; name: string }> }>(`${base}/restricted-holidays?${q.toString()}`);
  },
  balancePreview: (input: { userId: string; leaveTypeId: string; date: string }) => {
    const q = new URLSearchParams(Object.entries(input).filter(([, v]) => v) as [string, string][]);
    return api<{ cycle: string; balance: LeaveBalance | null }>(`${base}/balance-preview?${q.toString()}`);
  },
  balances: (year: number) => api<BalanceList>(`${base}/balances?year=${year}`),
  importTemplate: (year: number, cycle: 'CY' | 'FY') =>
    api<{ year: number; headers: string[]; rows: Array<Array<string | number>> }>(`${base}/balances/import/template?year=${year}&cycle=${cycle}`),
  reviewImport: (input: { strategy: ImportStrategy; csv: string }) =>
    api<ImportReview>(`${base}/balances/import/review`, { method: 'POST', body: input }),
  applyImport: (input: { strategy: ImportStrategy; csv: string }) =>
    api<ImportReview & { message: string }>(`${base}/balances/import`, { method: 'POST', body: input }),
  setBalance: (input: { userId: string; leaveTypeId: string; year: number; total: number; carryForward: number; reason?: string }) =>
    api<{ balance: LeaveBalance; message: string }>(`${base}/balances`, { method: 'PUT', body: { ...input, reason: input.reason || undefined } }),
  joining: () => api<{ today: string; items: JoiningItem[] }>(`${base}/joining`),
  joiningPrepare: (requestId: string) => api<{ item: JoiningItem; punch: { in: string | null; session: 'AM' | 'PM' | null } }>(`${base}/joining/prepare?requestId=${encodeURIComponent(requestId)}`),
  joiningSubmit: (requestId: string, certificate: JoiningFile | null) =>
    api<{ item: JoiningItem; message: string }>(`${base}/joining`, { method: 'POST', body: { requestId, certificate: certificate || undefined } }),
  joiningCorrect: (requestId: string, certificate: JoiningFile | null, removeCertificate = false) =>
    api<{ item: JoiningItem; message: string }>(`${base}/joining/${encodeURIComponent(requestId)}`, { method: 'PUT', body: { certificate: certificate || undefined, removeCertificate: removeCertificate || undefined } }),
  joiningDecide: (requestId: string, action: 'approve' | 'reject', comment: string) =>
    api<{ item: JoiningItem; outcome: 'approved' | 'forwarded' | 'rejected'; message: string }>(`${base}/joining/${encodeURIComponent(requestId)}/decision`, { method: 'POST', body: { action, comment: comment || undefined } }),
  downloadFitness: (requestId: string) => downloadCsv(`${base}/joining/${encodeURIComponent(requestId)}/fitness`, 'fitness-certificate'),
};
