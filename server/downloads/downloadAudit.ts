import type { Request } from 'express';
import { pool } from '../../src/db';
import { forbidden } from '../lib/http';
import { writeMasterAuditSql } from '../masters/audit';
import { Area, DOWNLOAD_AREAS, DownloadInput } from './downloadRules';

/**
 * Download log. Screens that build their CSV / PDF in the browser (attendance, manual attendance, outdoor duty, leave
 * requests and balances, holidays, user permissions) call this first, and only download when it succeeds, so every
 * download of employee data is in the audit log — who, when, which screen, what filter, how many rows — just like the
 * downloads that the server builds itself. Each area has its own audit key so the auditor sees it in that module's log.
 */

export async function logDownload(req: Request, input: DownloadInput): Promise<void> {
  const area = DOWNLOAD_AREAS[input.area] as Area;
  const role = req.auth!.activeRole;
  if (!role || !area.roles.includes(role)) throw forbidden('You are not allowed to download this.');
  await writeMasterAuditSql(pool, req, {
    masterKey: area.key, recordId: input.area, recordLabel: `${area.label} (${input.format.toUpperCase()})`, action: 'EXPORT',
    after: { rows: input.rows, format: input.format, filters: input.filters },
  });
}
