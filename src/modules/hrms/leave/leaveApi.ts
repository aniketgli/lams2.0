import { api } from '../../../shared/services/api';

export type LeaveStages = 1 | 2;
export type LeaveAccrual = 'yearly' | 'half_yearly' | 'quarterly' | 'monthly' | 'upfront';

export interface LeaveTypeRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  defaultQuota: number;
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
  employeeTypes: string[];
  gender: 'all' | 'female_only' | 'male_only';
  minServiceMonths: number;
  maxConsecutiveDays: number;
  isDebited: boolean;
  ccsRule: string;
  ccsCategory: string;
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
