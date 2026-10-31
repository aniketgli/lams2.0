import { api } from '../../../shared/services/api';

export interface QueueItem {
  id: string;
  name: string;
  department: string;
  designation: string;
  tag: string;
  when: string;
  where: string | null;
  days: number | null;
  text: string;
  note: string | null;
}
export interface Queue { total: number; items: QueueItem[] }
export interface BalanceLine { code: string; name: string; total: number; carryForward: number; used: number; pending: number; available: number }
export interface DashboardData {
  role: string | null;
  manual: Queue;
  od: Queue;
  leave: Queue;
  me: { punchIn: string | null; punchOut: string | null; balances: BalanceLine[] } | null;
}

export const dashboardApi = {
  get: () => api<DashboardData>('/hrms/dashboard'),
};
