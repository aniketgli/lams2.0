import { api } from '../../../shared/services/api';

export type Frequency = 'daily' | 'weekly' | 'monthly';
export type ReportFormat = 'csv' | 'pdf';

export interface ReportSchedule {
  id: string;
  name: string;
  reportKey: string;
  reportLabel: string;
  frequency: Frequency;
  weekday: number | null;
  monthDay: number | null;
  sendTime: string;
  /** "Every Monday at 09:00 IST", worked out by the server. */
  timing: string;
  formats: ReportFormat[];
  status: 'active' | 'paused';
  users: { id: string; name: string; email: string }[];
  roles: { id: string; label: string }[];
  lastRunAt: string | null;
  lastStatus: 'sent' | 'partial' | 'failed' | 'no_recipients' | null;
  lastMessage: string | null;
  nextRun: string | null;
}

export interface ReportOption { key: string; label: string; description: string; snapshot: boolean }
export interface ReportPerson { id: string; name: string; biometricId: string; email: string; designation: string }

export interface ReportSchedules {
  schedules: ReportSchedule[];
  reports: ReportOption[];
  roles: { id: string; label: string }[];
  people: ReportPerson[];
}

export interface ScheduleInput {
  name: string;
  reportKey: string;
  frequency: Frequency;
  weekday: number | null;
  monthDay: number | null;
  sendTime: string;
  formats: ReportFormat[];
  userIds: string[];
  roles: string[];
  status: 'active' | 'paused';
}

export interface ReportRun { id: string; ranAt: string; trigger: 'schedule' | 'manual'; periodFrom: string | null; periodTo: string | null; status: string; sentCount: number; message: string | null }

const base = '/hrms/reports/schedules';
const one = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const reportsApi = {
  list: () => api<ReportSchedules>(base),
  create: (input: ScheduleInput) => api<{ schedule: ReportSchedule; message: string }>(base, { method: 'POST', body: input }),
  update: (id: string, input: ScheduleInput) => api<{ schedule: ReportSchedule; message: string }>(one(id), { method: 'PUT', body: input }),
  setStatus: (id: string, status: 'active' | 'paused') => api<{ schedule: ReportSchedule; message: string }>(`${one(id)}/status`, { method: 'PATCH', body: { status } }),
  remove: (id: string, reason?: string) => api<{ message: string }>(one(id), { method: 'DELETE', body: { reason } }),
  sendNow: (id: string) => api<{ schedule: ReportSchedule; message: string; result: { status: string; sent: number; message: string } }>(`${one(id)}/send`, { method: 'POST' }),
  runs: (id: string) => api<{ schedule: ReportSchedule; runs: ReportRun[] }>(`${one(id)}/runs`),
};
