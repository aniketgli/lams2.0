import { api } from '../../../shared/services/api';

/** Client for /api/hrms/attendance (biometric attendance, read-only). */

export interface AttendanceDay {
  userId: string;
  biometricId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  totalHours: number | null;
  punches: number;
  status: 'PP' | 'AA' | 'PA' | 'AP' | 'WW' | 'WW#' | 'GH' | 'HH#' | 'OD';
  workMode: 'in_office' | 'absent' | 'field_od';
  shiftCode: string;
  lateByMins: number;
  earlyByMins: number;
  devices: string[];
  remark: string;
}

export interface AttendanceResponse {
  from: string;
  to: string;
  machinesConfigured: boolean;
  records: AttendanceDay[];
  shifts: { code: string; name: string; startTime: string; endTime: string }[];
}

export const attendanceApi = {
  list: (from: string, to: string) =>
    api<AttendanceResponse>(`/hrms/attendance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};
