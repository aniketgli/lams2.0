import { ApiError, api } from './api';

/**
 * Screens that build their CSV / PDF in the browser record the download on the server first, and download only when that
 * succeeded, so every download of employee data is in the audit log (who, when, which screen, which filter, how many rows).
 */
export type DownloadArea = 'attendance' | 'manual_attendance' | 'outdoor_duty' | 'leave_requests' | 'leave_balances' | 'holidays' | 'user_controls';

export async function logThenDownload(
  area: DownloadArea,
  format: 'csv' | 'pdf',
  rows: number,
  filters: string,
  download: () => void,
  onError: (message: string) => void,
): Promise<void> {
  try {
    await api('/hrms/downloads/log', { method: 'POST', body: { area, format, rows, filters: filters || undefined } });
  } catch (e) {
    onError(e instanceof ApiError ? e.message : 'The download could not be recorded, so it was not started. Please try again.');
    return;
  }
  download();
}
