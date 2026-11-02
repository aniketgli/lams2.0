import { api } from '../../../shared/services/api';
import { PrintableTable, downloadCsv } from '../../../shared/services/activityApi';

/** Client for the Employees Mapping routes (/api/hrms/mapping). The server validates every order. */

export interface MappingPerson {
  id: string;
  biometricId: string;
  name: string;
  status: string;
  institute: string | null;
  employmentType: string | null;
  designation: string | null;
  department: string | null;
  reportingManagerId: string | null;
  reviewingManagerId: string | null;
}

export interface MappingData {
  people: MappingPerson[];
  departments: { name: string; institute: string | null }[];
}

export interface MappingLogRow {
  id: string;
  batchId: string;
  kind: 'transfer' | 'manager_change';
  userId: string;
  biometricId: string;
  employeeName: string;
  prevDepartment: string | null;
  newDepartment: string | null;
  prevReportingManager: string | null;
  newReportingManager: string | null;
  prevHod: string | null;
  newHod: string | null;
  effectiveDate: string;
  notes: string | null;
  doneBy: string | null;
  doneByBiometricId: string | null;
  createdAt: string;
}

export interface MappingLogQuery { kind?: string; department?: string; from?: string; to?: string; search?: string }

export interface OrderResult { batchId: string; changed: number; unchanged: number; message: string }

export interface TransferOrder {
  userIds: string[];
  department?: string;
  reportingManagerId?: string;
  reviewingManagerId?: string;
  effectiveDate: string;
  notes?: string;
}

export interface ReplaceOrder {
  outgoingManagerId: string;
  incomingManagerId: string;
  scope: 'reporting' | 'reviewing' | 'both';
  userIds: string[];
  effectiveDate: string;
  notes?: string;
}

const qs = (q: MappingLogQuery) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : '';
};

export const mappingApi = {
  data: () => api<MappingData>('/hrms/mapping/data'),
  log: (q: MappingLogQuery) => api<{ rows: MappingLogRow[]; truncated: boolean }>(`/hrms/mapping/log${qs(q)}`),
  downloadCsv: (q: MappingLogQuery) => downloadCsv(`/hrms/mapping/log.csv${qs(q)}`, 'WII_Employee_Mapping_Register.csv'),
  forPdf: (q: MappingLogQuery) => api<PrintableTable>(`/hrms/mapping/log/export-pdf${qs(q)}`),
  transfer: (order: TransferOrder) => api<OrderResult>('/hrms/mapping/transfer', { method: 'POST', body: order }),
  replaceManager: (order: ReplaceOrder) => api<OrderResult>('/hrms/mapping/replace-manager', { method: 'POST', body: order }),
};
