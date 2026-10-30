import { ApiError, api } from './api';

/**
 * Shared client pieces for audit/activity logs and downloads. Each log
 * (employees, holidays, …) is served at its own base path with the same
 * routes: GET base, GET base.csv, GET base/export-pdf.
 */

export interface ActivityRow {
  id: string;
  at: string;
  area: string;
  action: string;
  recordId: string;
  recordLabel: string | null;
  changedFields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  actor: { biometricId: string | null; name: string | null; role: string | null };
}

export interface ActivityQuery { area?: string; action?: string; from?: string; to?: string; search?: string; page?: number; pageSize?: number }

export const queryString = (q: ActivityQuery) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
};

/** Fetches a CSV from the server and saves it, keeping the server's file name. */
export async function downloadCsv(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', headers: { Accept: 'text/csv' } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.message || 'The download failed.', body?.code, body?.details);
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface PrintableTable { generatedAt: string; headers: string[]; rows: unknown[][] }


/** The three calls every activity log offers, for a base path such as '/hrms/holidays/activity'. */
export function activityEndpoints(base: string, csvName: string) {
  const noPaging = (q: ActivityQuery) => queryString({ ...q, page: undefined, pageSize: undefined });
  return {
    list: (q: ActivityQuery) => api<{ rows: ActivityRow[]; total: number; page: number; pageSize: number }>(`${base}${queryString(q)}`),
    downloadCsv: (q: ActivityQuery) => downloadCsv(`${base}.csv${noPaging(q)}`, csvName),
    forPdf: (q: ActivityQuery) => api<PrintableTable>(`${base}/export-pdf${noPaging(q)}`),
  };
}
