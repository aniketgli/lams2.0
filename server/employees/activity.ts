import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { badRequest } from '../lib/http';
import { isValidIsoDate } from '../lib/validate';
import { writeMasterAuditSql } from '../masters/audit';
import { EmployeeRecord, Viewer, listEmployees } from './store';

/**
 * Auditor tools for employee records: a CSV download of the directory and
 * the activity log (who created, changed, deactivated or deleted employees,
 * changed roles, reset passwords or photos), with its own CSV export.
 * Every download is itself written to the audit log.
 */

/** Audit keys that belong to employee records. */
export const EMPLOYEE_ACTIVITY_KEYS = ['employee', 'user_roles', 'employee_password', 'employee_photo', 'employee_export'] as const;

const ACTIONS = ['CREATE', 'UPDATE', 'STATUS', 'DELETE', 'RESET', 'EXPORT'] as const;

/** One CSV cell. Values that a spreadsheet would run as a formula are prefixed with a quote. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 names correctly.
  return `﻿${[headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function parseData(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function lookupNames(type: string): Promise<Map<string, string>> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT code, name FROM lookup_values WHERE lookup_type = ?', [type]);
  return new Map(rows.map((r) => [String(r.code), String(r.name)]));
}

// ---------------------------------------------------------------------------
// Directory download
// ---------------------------------------------------------------------------

export async function employeeDirectoryCsv(req: Request, viewer: Viewer): Promise<{ filename: string; csv: string; count: number }> {
  const records: EmployeeRecord[] = await listEmployees(viewer);
  const [types, institutes] = await Promise.all([lookupNames('employee_type'), lookupNames('institute')]);
  const nameById = new Map(records.map((r) => [r.id, `${r.name} (${r.biometricId})`]));

  const headers = [
    'Biometric ID', 'Salutation', 'Name', 'Official email', 'Mobile', 'Organization', 'Employee type', 'Department / Project',
    'Designation', 'Category', 'Date of joining', 'Valid up to', 'Reporting manager', 'HoD', 'HRMS roles', 'Status',
  ];
  const rows = records.map((r) => {
    const d = parseData(r.profileData);
    return [
      r.biometricId, r.suffix, r.name, r.email, r.phone, institutes.get(r.institute ?? '') ?? r.institute,
      types.get(r.employmentType ?? '') ?? r.employmentType, r.department, r.designation, d.employeeCategory ?? d.courseProgram ?? '',
      r.joiningDate, r.validUpto, nameById.get(String(d.reportingManagerId ?? '')) ?? '', nameById.get(String(d.reviewingManagerId ?? '')) ?? '',
      r.roles.join(' / '), r.status,
    ];
  });

  await writeMasterAuditSql(pool, req, {
    masterKey: 'employee_export', recordId: 'directory', recordLabel: 'Employee directory (CSV)', action: 'EXPORT',
    after: { rows: rows.length },
  });
  const day = new Date().toISOString().slice(0, 10);
  return { filename: `WII_Employee_Directory_${day}.csv`, csv: toCsv(headers, rows), count: rows.length };
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export interface ActivityFilter {
  action: (typeof ACTIONS)[number] | null;
  area: (typeof EMPLOYEE_ACTIVITY_KEYS)[number] | null;
  from: string | null;
  to: string | null;
  search: string | null;
  page: number;
  pageSize: number;
}

export function parseActivityFilter(query: Record<string, unknown>): ActivityFilter {
  const one = (k: string) => (typeof query[k] === 'string' && query[k] ? String(query[k]).trim() : null);
  const action = one('action')?.toUpperCase() ?? null;
  if (action && !(ACTIONS as readonly string[]).includes(action)) throw badRequest('Unknown action.');
  const area = one('area');
  if (area && !(EMPLOYEE_ACTIVITY_KEYS as readonly string[]).includes(area)) throw badRequest('Unknown area.');
  const from = one('from');
  const to = one('to');
  if (from && !isValidIsoDate(from)) throw badRequest('Invalid from date.');
  if (to && !isValidIsoDate(to)) throw badRequest('Invalid to date.');
  if (from && to && from > to) throw badRequest('The from date must be on or before the to date.');
  return {
    action: action as ActivityFilter['action'],
    area: area as ActivityFilter['area'],
    from, to,
    search: one('search')?.slice(0, 100) ?? null,
    page: Math.max(1, Math.min(10_000, Number(query.page) || 1)),
    pageSize: Math.max(10, Math.min(100, Number(query.pageSize) || 25)),
  };
}

function whereFor(f: ActivityFilter): { sql: string; params: unknown[] } {
  const where = [`master_key IN (${EMPLOYEE_ACTIVITY_KEYS.map(() => '?').join(',')})`];
  const params: unknown[] = [...EMPLOYEE_ACTIVITY_KEYS];
  if (f.area) { where.push('master_key = ?'); params.push(f.area); }
  if (f.action) { where.push('action = ?'); params.push(f.action); }
  if (f.from) { where.push('created_at >= ?'); params.push(`${f.from} 00:00:00`); }
  if (f.to) { where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.to); }
  if (f.search) {
    const term = `%${f.search.replace(/[%_\\]/g, '\\$&')}%`;
    where.push('(record_label LIKE ? OR record_id LIKE ? OR actor_name LIKE ? OR actor_biometric_id LIKE ? OR reason LIKE ?)');
    params.push(term, term, term, term, term);
  }
  return { sql: `WHERE ${where.join(' AND ')}`, params };
}

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

function toActivity(r: RowDataPacket): ActivityRow {
  return {
    id: String(r.id),
    at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    area: String(r.master_key),
    action: String(r.action),
    recordId: String(r.record_id),
    recordLabel: r.record_label ? String(r.record_label) : null,
    changedFields: r.changed_fields ? String(r.changed_fields).split(',').filter(Boolean) : [],
    before: r.before_data ? parseData(String(r.before_data)) : null,
    after: r.after_data ? parseData(String(r.after_data)) : null,
    reason: r.reason ? String(r.reason) : null,
    actor: { biometricId: r.actor_biometric_id ?? null, name: r.actor_name ?? null, role: r.actor_role ?? null },
  };
}

const SELECT = `SELECT id, created_at, master_key, action, record_id, record_label, changed_fields, before_data, after_data,
                       reason, actor_biometric_id, actor_name, actor_role FROM master_audit_logs`;

export async function listActivity(f: ActivityFilter): Promise<{ rows: ActivityRow[]; total: number; page: number; pageSize: number }> {
  const { sql, params } = whereFor(f);
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM master_audit_logs ${sql}`, params);
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT} ${sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, f.pageSize, (f.page - 1) * f.pageSize],
  );
  return { rows: rows.map(toActivity), total: Number(count?.n ?? 0), page: f.page, pageSize: f.pageSize };
}

const AREA_LABELS: Record<string, string> = {
  employee: 'Employee profile', user_roles: 'Module roles', employee_password: 'Password',
  employee_photo: 'Profile photo', employee_export: 'Data download',
};

/** Readable "field: old → new" summary of one log entry. */
export function describeChange(row: ActivityRow): string {
  const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  if (row.action === 'UPDATE' || row.action === 'STATUS') {
    const keys = row.changedFields.length ? row.changedFields : Object.keys(row.after ?? {});
    return keys.map((k) => `${k}: ${show(row.before?.[k])} → ${show(row.after?.[k])}`).join('; ');
  }
  const data = row.action === 'DELETE' ? row.before : row.after;
  return Object.entries(data ?? {}).slice(0, 12).map(([k, v]) => `${k}: ${show(v)}`).join('; ');
}

export const MAX_ACTIVITY_EXPORT = 10_000;

export async function activityCsv(req: Request, f: ActivityFilter): Promise<{ filename: string; csv: string; count: number }> {
  const { sql, params } = whereFor(f);
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} ${sql} ORDER BY created_at DESC, id DESC LIMIT ?`, [...params, MAX_ACTIVITY_EXPORT]);
  const items = rows.map(toActivity);
  const headers = ['When (UTC)', 'Area', 'Action', 'Record', 'Biometric ID / ref', 'Changes', 'Reason', 'Done by', 'Done by (B.I.)', 'Role'];
  const csvRows = items.map((r) => [
    r.at, AREA_LABELS[r.area] ?? r.area, r.action, r.recordLabel, r.recordId, describeChange(r), r.reason,
    r.actor.name, r.actor.biometricId, r.actor.role,
  ]);
  await writeMasterAuditSql(pool, req, {
    masterKey: 'employee_export', recordId: 'activity', recordLabel: 'Employee activity log (CSV)', action: 'EXPORT',
    after: { rows: csvRows.length, area: f.area, action: f.action, from: f.from, to: f.to, search: f.search },
  });
  const day = new Date().toISOString().slice(0, 10);
  return { filename: `WII_Employee_Activity_${day}.csv`, csv: toCsv(headers, csvRows), count: csvRows.length };
}
