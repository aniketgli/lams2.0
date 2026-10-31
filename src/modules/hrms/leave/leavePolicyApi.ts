import { api } from '../../../shared/services/api';
import type { LeaveAccrual } from './leaveApi';

export type PolicyStatus = 'draft' | 'active' | 'inactive';
export type Counted = 'included' | 'excluded';
export type Allow = 'allowed' | 'not_allowed';
export type Scope = 'all' | 'selected';

export interface PolicyItem {
  leaveTypeId: string;
  leaveTypeName?: string;
  leaveTypeCode?: string;
  annualEntitlement: number;
  accrual: LeaveAccrual;
  accrualQuantity: number;
  maxBalance: number;
  minApplication: number;
  maxApplication: number;
  carryForward: boolean;
  carryLimit: number;
  encashment: boolean;
  encashLimit: number;
  halfDay: boolean;
  documentRequired: boolean;
  probationApplicable: boolean;
  negativeBalance: boolean;
  conditions: string;
}

export interface PolicyInput {
  code: string;
  name: string;
  employeeCategory: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
  yearCycle: 'calendar' | 'financial' | '';
  status: 'draft' | 'active';
  description: string;
  items: PolicyItem[];
  proRata: boolean;
  midYearJoining: 'prorata' | 'full' | 'none' | '';
  backdatedLeave: Allow | '';
  noticePeriodLeave: Allow | '';
  sandwichRule: Counted | '';
  weeklyOff: Counted | '';
  publicHoliday: Counted | '';
  separationBalance: 'lapse' | 'encash' | 'adjust' | '';
  generalRemarks: string;
  approvalMode: 'single_level' | 'two_level' | '';
  workflowStatus: 'enabled' | 'disabled' | '';
  l1Role: string;
  l1Mandatory: boolean;
  l2Role: string;
  l2Mandatory: boolean;
  assignmentMethod: 'automatic' | 'manual' | 'default_override' | '';
  departmentScope: Scope;
  departments: string[];
  designationScope: Scope;
  designations: string[];
  assignmentRemarks: string;
  referenceNo: string;
  orderDate: string;
  officialRemarks: string;
  reason?: string;
}

export interface PolicyRecord extends Omit<PolicyInput, 'status'> {
  id: string;
  status: PolicyStatus;
  editable: boolean;
  updatedAt: string | null;
}

export interface PolicyOptions {
  employeeTypes: Array<{ code: string; name: string }>;
  leaveTypes: Array<{ id: string; code: string; name: string }>;
  departments: string[];
  designations: string[];
  roles: Array<{ id: string; label: string }>;
}

export interface PolicyList { policies: PolicyRecord[]; options: PolicyOptions }

const base = '/hrms/leave-policies';
type Saved = { policy: PolicyRecord; message: string };

export const leavePolicyApi = {
  list: () => api<PolicyList>(base),
  create: (input: PolicyInput) => api<Saved>(base, { method: 'POST', body: input }),
  update: (id: string, input: PolicyInput) => api<Saved>(`${base}/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
  setStatus: (id: string, status: 'active' | 'inactive', reason?: string) => api<Saved>(`${base}/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status, reason } }),
  newVersion: (id: string, input: { version: string; effectiveFrom: string; reason?: string }) => api<Saved>(`${base}/${encodeURIComponent(id)}/version`, { method: 'POST', body: input }),
  remove: (id: string, reason?: string) => api<{ message: string }>(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE', body: { reason } }),
};
