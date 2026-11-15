import type { Request, Response } from 'express';
import { reportFileName, withCsvReportFrame } from '../../src/shared/services/printTable';
import { ROLE_LABELS, type RoleId } from './roles';
import { attachmentDisposition } from './http';

/** "Employee Directory" from "WII_Employee_Directory_2026-11-15.csv". */
export function titleFromFileName(filename: string): string {
  const stem = filename.replace(/\.csv$/i, '').replace(/^WII_/i, '').replace(/_\d{4}-\d{2}-\d{2}.*$/, '');
  return stem.replace(/_/g, ' ').trim() || 'Report';
}

/** "Name (biometric ID) · Role" of the signed-in person. */
export function generatedByOf(req: Request): string | null {
  const auth = req.auth;
  if (!auth) return null;
  const role = auth.activeRole ? ROLE_LABELS[auth.activeRole as RoleId] : null;
  return `${auth.account.name} (${auth.account.biometricId})${role ? ` · ${role}` : ''}`;
}

/**
 * Sends a server-built CSV the same way the screens' downloads look: the standard report header
 * (organization, report, generated on / by, records) and footer around the table, and the standard
 * file name WII_<Report>_<YYYY-MM-DD_HHmm>.csv.
 */
export async function sendCsvReport(res: Response, file: { filename: string; csv: string; title?: string; subtitle?: string[] }): Promise<void> {
  const req = res.req as Request;
  let organization = 'Wildlife Institute of India';
  try {
    const { getOrganization } = await import('../masters/organizationStore');
    organization = (await getOrganization())?.orgName || organization;
  } catch { /* organization settings not available: keep the default name */ }
  const title = file.title ?? titleFromFileName(file.filename);
  const body = withCsvReportFrame(file.csv.replace(/^﻿/, ''), { title, subtitle: file.subtitle, meta: { organization, generatedBy: generatedByOf(req) } });
  const name = `${reportFileName(file.filename.replace(/\.csv$/i, '').replace(/_\d{4}-\d{2}-\d{2}$/, ''))}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', attachmentDisposition(name, 'report'));
  res.send(`﻿${body}`);
}
