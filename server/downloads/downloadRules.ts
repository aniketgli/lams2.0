import type { RoleId } from '../lib/roles';
import { Validator } from '../lib/validate';

/** Which screens can log a download, under which audit key, and for which roles. Pure (no database) so it can be tested alone. */

export interface Area { key: string; label: string; roles: RoleId[] }

const EVERYONE: RoleId[] = ['administrator', 'audit', 'reviewing_manager', 'reporting_manager', 'general_staff'];
const ADMIN_AUDIT: RoleId[] = ['administrator', 'audit'];

export const DOWNLOAD_AREAS = {
  attendance: { key: 'attendance_data_export', label: 'Attendance', roles: EVERYONE },
  manual_attendance: { key: 'manual_attendance_data_export', label: 'Manual attendance', roles: EVERYONE },
  outdoor_duty: { key: 'outdoor_duty_data_export', label: 'Outdoor duty', roles: EVERYONE },
  leave_requests: { key: 'leave_data_export', label: 'Leave requests', roles: EVERYONE },
  leave_balances: { key: 'leave_data_export', label: 'Leave balances', roles: ADMIN_AUDIT },
  holidays: { key: 'holiday_data_export', label: 'Holiday calendar', roles: EVERYONE },
  user_controls: { key: 'employee_data_export', label: 'User permissions', roles: ADMIN_AUDIT },
} satisfies Record<string, Area>;

export type DownloadArea = keyof typeof DOWNLOAD_AREAS;
export const DOWNLOAD_AREA_NAMES = Object.keys(DOWNLOAD_AREAS) as DownloadArea[];

export interface DownloadInput { area: DownloadArea; format: 'csv' | 'pdf'; rows: number; filters: string | null }

export function parseDownload(body: unknown): DownloadInput {
  const v = new Validator(body);
  const area = v.oneOf('area', DOWNLOAD_AREA_NAMES)!;
  const format = v.oneOf('format', ['csv', 'pdf'] as const)!;
  const rows = v.int('rows', { min: 0, max: 1_000_000 }) ?? 0;
  const filters = v.optionalString('filters', { max: 500 });
  v.assert();
  return { area, format, rows, filters };
}

