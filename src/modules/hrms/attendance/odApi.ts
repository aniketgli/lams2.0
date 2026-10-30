import { api } from '../../../shared/services/api';

/** Client for /api/hrms/outdoor-duty. The server checks every field and every role. */

export type OdStatus = 'pending' | 'approved' | 'rejected';
export type OdType = 'Domestic' | 'International';

export interface OdRequest {
  id: string;
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysCount: number;
  odType: OdType;
  location: string;
  estimatedFunds: number;
  fundingSource: string | null;
  purpose: string;
  status: OdStatus;
  appliedAt: string;
  appliedById: string;
  appliedByName: string;
  managerId: string | null;
  managerName: string | null;
  actionByName: string | null;
  actionAt: string | null;
  comment: string | null;
  canDecide: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canUndo: boolean;
}

export interface OdList {
  from: string;
  to: string;
  requests: OdRequest[];
  /** Employees an administrator can apply for (empty for everyone else). */
  employees: { id: string; biometricId: string; name: string; designation: string }[];
  types: OdType[];
}

export interface OdInput {
  userId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  odType: OdType;
  location: string;
  estimatedFunds: string;
  fundingSource: string;
  purpose: string;
}

const base = '/hrms/outdoor-duty';
const one = (id: string) => `${base}/${encodeURIComponent(id)}`;
const body = (i: OdInput) => ({ ...i, userId: i.userId || undefined, estimatedFunds: i.estimatedFunds === '' ? 0 : i.estimatedFunds, fundingSource: i.fundingSource || undefined });

export const odApi = {
  list: (from: string, to: string) => api<OdList>(`${base}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  create: (input: OdInput) => api<{ request: OdRequest; message: string }>(base, { method: 'POST', body: body(input) }),
  update: (id: string, input: OdInput) => api<{ request: OdRequest; changed: string[]; message: string }>(one(id), { method: 'PUT', body: body(input) }),
  decide: (id: string, action: 'approve' | 'reject', comment: string) =>
    api<{ request: OdRequest; message: string }>(`${one(id)}/decision`, { method: 'POST', body: { action, comment: comment || undefined } }),
  undo: (id: string, reason?: string) => api<{ request: OdRequest; message: string }>(`${one(id)}/undo`, { method: 'POST', body: { reason: reason || undefined } }),
  remove: (id: string, reason?: string) => api<{ message: string }>(one(id), { method: 'DELETE', body: { reason: reason || undefined } }),
};
