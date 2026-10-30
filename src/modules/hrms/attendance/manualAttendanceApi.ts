import { api } from '../../../shared/services/api';

/** Client for /api/hrms/manual-attendance. The server checks every field and every role. */

export type ManualStatus = 'pending' | 'approved' | 'rejected';

export interface ManualRequest {
  id: string;
  userId: string;
  biometricId: string;
  name: string;
  designation: string;
  department: string;
  date: string;
  inTime: string;
  outTime: string;
  originalIn: string | null;
  originalOut: string | null;
  category: string;
  reason: string;
  status: ManualStatus;
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

export interface ManualList {
  from: string;
  to: string;
  requests: ManualRequest[];
  /** Employees an administrator can apply for (empty for everyone else). */
  employees: { id: string; biometricId: string; name: string; designation: string }[];
  categories: string[];
}

export interface ManualInput {
  userId: string;
  date: string;
  inTime: string;
  outTime: string;
  category: string;
  reason: string;
}

export interface PunchGap { date: string; in: string | null; out: string | null }

const base = '/hrms/manual-attendance';
const one = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const manualAttendanceApi = {
  list: (from: string, to: string) => api<ManualList>(`${base}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  /** Dates (latest first) with a missing In and / or Out punch and no open request. `userId` is for administrators. */
  missingPunches: (userId?: string) => api<{ dates: PunchGap[] }>(`${base}/missing-punches${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),
  create: (input: ManualInput) => api<{ request: ManualRequest; message: string }>(base, { method: 'POST', body: { ...input, userId: input.userId || undefined } }),
  update: (id: string, input: ManualInput) => api<{ request: ManualRequest; changed: string[]; message: string }>(one(id), { method: 'PUT', body: input }),
  decide: (id: string, action: 'approve' | 'reject', comment: string) =>
    api<{ request: ManualRequest; message: string }>(`${one(id)}/decision`, { method: 'POST', body: { action, comment: comment || undefined } }),
  undo: (id: string, reason?: string) => api<{ request: ManualRequest; message: string }>(`${one(id)}/undo`, { method: 'POST', body: { reason: reason || undefined } }),
  remove: (id: string, reason?: string) => api<{ message: string }>(one(id), { method: 'DELETE', body: { reason: reason || undefined } }),
};
