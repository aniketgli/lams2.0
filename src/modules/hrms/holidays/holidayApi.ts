import { api } from '../../../shared/services/api';
import type { HolidayItem } from './data/holidayData';

/** Client for /api/hrms/holidays. The server checks every field and every role. */

export interface HolidayRecord {
  id: string;
  date: string;
  name: string;
  hindiName: string | null;
  type: HolidayItem['type'];
  category: string;
  description: string | null;
  dayOfWeek: string;
  year: number;
  month: number;
  isLongWeekend: boolean;
  updatedAt: string | null;
}

export interface HolidayInput {
  date: string;
  name: string;
  hindiName: string;
  type: HolidayItem['type'];
  category: string;
  description: string;
}

export interface HolidayList { holidays: HolidayRecord[]; years: number[]; types: string[]; categories: string[] }

/** Shape the rest of the app (leave, attendance, dashboards) already uses. */
export const toHolidayItem = (h: HolidayRecord): HolidayItem => ({
  id: h.id,
  name: h.name,
  hindiName: h.hindiName ?? undefined,
  date: h.date,
  dayOfWeek: h.dayOfWeek,
  type: h.type,
  category: h.category as HolidayItem['category'],
  description: h.description ?? '',
  year: h.year,
  month: h.month,
  isLongWeekend: h.isLongWeekend,
});

export const holidayApi = {
  list: (year?: number) => api<HolidayList>(`/hrms/holidays${year ? `?year=${year}` : ''}`),
  create: (input: HolidayInput) => api<{ holiday: HolidayRecord; message: string }>('/hrms/holidays', { method: 'POST', body: input }),
  update: (id: string, input: HolidayInput) =>
    api<{ holiday: HolidayRecord; changed: string[]; message: string }>(`/hrms/holidays/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
  remove: (id: string, reason?: string) =>
    api<{ message: string }>(`/hrms/holidays/${encodeURIComponent(id)}`, { method: 'DELETE', body: { reason: reason || undefined } }),
};
