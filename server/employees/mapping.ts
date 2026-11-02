import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { todayInIndia } from '../lib/validate';
import { writeMasterAuditSql } from '../masters/audit';
import { LAYOUT_RULES } from './fields';
import { activeMasterValue, layoutOfEmployeeType } from './references';
import { LogFilter, ReplaceInput, TransferInput, parseReplace, parseTransfer } from './mappingRules';
import { toCsv } from './activity';

/**
 * Employees Mapping: transfers between departments and changes of reporting manager / HoD.
 * Every order is validated and applied in one transaction, written to the audit log (one entry
 * per employee) and to the mapping register (employee_mapping_log) that the screen and the
 * downloads read.
 */

export const AUDIT_MAPPING = 'employee_mapping';
export const AUDIT_MAPPING_EXPORT = 'employee_mapping_export';

type Q = Pick<PoolConnection, 'query'>;

async function rows(q: Q, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await q.query<RowDataPacket[]>(sql, params);
  return result;
}

function profileData(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const idOf = (value: unknown): string | null => (value === undefined || value === null || value === '' ? null : String(value));

// ---------------------------------------------------------------------------
// Screen data
// ---------------------------------------------------------------------------

export interface MappingPerson {
  id: string;
  biometricId: string;
  name: string;
  status: string;
  institute: string | null;
  employmentType: string | null;
  designation: string | null;
  department: string | null;
  reportingManagerId: string | null;
  reviewingManagerId: string | null;
}

export interface MappingData {
  people: MappingPerson[];
  departments: { name: string; institute: string | null }[];
}

/** Everyone an order can cover (active, non-system) with their current department and managers, plus the departments. */
export async function mappingData(): Promise<MappingData> {
  const found = await rows(pool,
    `SELECT u.id, u.biometric_id, u.name, u.status, p.institute, p.employment_type, p.designation, p.department, p.profile_data
       FROM users u JOIN employee_profiles p ON p.biometric_id = u.biometric_id
      WHERE u.is_system = 0 AND LOWER(u.status) = 'active'
      ORDER BY u.name`);
  const departments = await rows(pool, "SELECT name, institute FROM organization_units WHERE UPPER(status) = 'ACTIVE' ORDER BY name");
  return {
    people: found.map((r) => {
      const d = profileData(r.profile_data);
      return {
        id: String(r.id), biometricId: String(r.biometric_id), name: String(r.name), status: String(r.status),
        institute: r.institute ? String(r.institute) : null, employmentType: r.employment_type ? String(r.employment_type) : null,
        designation: r.designation ? String(r.designation) : null, department: r.department ? String(r.department) : null,
        reportingManagerId: idOf(d.reportingManagerId), reviewingManagerId: idOf(d.reviewingManagerId),
      };
    }),
    departments: departments.map((r) => ({ name: String(r.name), institute: r.institute ? String(r.institute) : null })),
  };
}

// ---------------------------------------------------------------------------
// Applying an order
// ---------------------------------------------------------------------------

interface Target {
  id: number;
  biometricId: string;
  name: string;
  status: string;
  institute: string | null;
  employmentType: string | null;
  department: string;
  data: Record<string, unknown>;
}

interface Person { id: string; name: string; biometricId: string }

/** Locks the employees (in id order, so two orders cannot deadlock) and returns them. */
async function lockTargets(conn: Q, ids: number[]): Promise<Target[]> {
  if (!ids.length) return [];
  const found = await rows(conn,
    `SELECT u.id, u.biometric_id, u.name, u.status, u.is_system, p.institute, p.employment_type, p.department, p.profile_data
       FROM users u JOIN employee_profiles p ON p.biometric_id = u.biometric_id
      WHERE u.id IN (${ids.map(() => '?').join(',')}) ORDER BY u.id FOR UPDATE`, ids);
  if (found.length !== ids.length) throw notFound('One of the selected employees was not found.');
  return found.map((r) => {
    if (Number(r.is_system ?? 0) === 1) throw new HttpError(403, 'System accounts cannot be transferred.', 'SYSTEM_ACCOUNT');
    return {
      id: Number(r.id), biometricId: String(r.biometric_id), name: String(r.name), status: String(r.status),
      institute: r.institute ? String(r.institute) : null, employmentType: r.employment_type ? String(r.employment_type) : null,
      department: String(r.department ?? ''), data: profileData(r.profile_data),
    };
  });
}

/** A manager / HoD must be an active, non-system employee of the same organization as the person. */
async function managerFor(conn: Q, id: number, institute: string | null, cache: Map<string, Person | null>): Promise<Person | null> {
  const key = `${id}|${institute ?? ''}`;
  if (cache.has(key)) return cache.get(key)!;
  const [row] = await rows(conn,
    `SELECT u.id, u.name, u.biometric_id, u.status, u.is_system, p.institute FROM users u
       LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [id]);
  let result: Person | null = null;
  if (row && Number(row.is_system ?? 0) !== 1 && String(row.status).toLowerCase() === 'active' && !(row.institute && institute && String(row.institute) !== institute)) {
    result = { id: String(row.id), name: String(row.name), biometricId: String(row.biometric_id) };
  }
  cache.set(key, result);
  return result;
}

async function personName(conn: Q, id: string | null, cache: Map<string, Person | null>): Promise<Person | null> {
  if (!id) return null;
  const key = `name|${id}`;
  if (!cache.has(key)) {
    const [row] = await rows(conn, 'SELECT id, name, biometric_id FROM users WHERE id = ? LIMIT 1', [Number(id)]);
    cache.set(key, row ? { id: String(row.id), name: String(row.name), biometricId: String(row.biometric_id) } : null);
  }
  return cache.get(key)!;
}

interface Change {
  target: Target;
  department?: string;
  reportingManager?: Person;
  reviewingManager?: Person;
}

const label = (p: Person | null) => (p ? `${p.name} (${p.biometricId})` : null);

/** Writes the changes, the audit entries and the register rows. Returns who must hear about it. */
async function apply(conn: PoolConnection, req: Request, kind: 'transfer' | 'manager_change', changes: Change[], meta: { effectiveDate: string; notes: string | null }, names: Map<string, Person | null>) {
  const actor = req.auth!.account;
  const batchId = randomUUID();
  for (const change of changes) {
    const { target } = change;
    const before = { department: target.department || null, reportingManager: label(await personName(conn, idOf(target.data.reportingManagerId), names)), hod: label(await personName(conn, idOf(target.data.reviewingManagerId), names)) };
    const prevRm = await personName(conn, idOf(target.data.reportingManagerId), names);
    const prevHod = await personName(conn, idOf(target.data.reviewingManagerId), names);

    const data = { ...target.data };
    if (change.reportingManager) {
      data.reportingManagerId = change.reportingManager.id;
      // A researcher's PI is their reporting manager.
      if (data.piName !== undefined) data.piName = change.reportingManager.name;
    }
    if (change.reviewingManager) {
      data.reviewingManagerId = change.reviewingManager.id;
      data.hodName = change.reviewingManager.name;
    }
    const department = change.department ?? target.department;
    await conn.query('UPDATE employee_profiles SET department = ?, profile_data = ? WHERE biometric_id = ?', [department, JSON.stringify(data), target.biometricId]);

    const newRm = change.reportingManager ?? prevRm;
    const newHod = change.reviewingManager ?? prevHod;
    const after = { department: department || null, reportingManager: label(newRm), hod: label(newHod) };
    await conn.query(
      'UPDATE users SET last_updated_by = ?, last_updated_at = NOW(), last_update_summary = ? WHERE id = ?',
      [actor.biometricId, `${kind === 'transfer' ? 'Transferred' : 'Manager changed'} (effective ${meta.effectiveDate})`.slice(0, 1000), target.id],
    );
    await writeMasterAuditSql(conn, req, {
      masterKey: AUDIT_MAPPING, recordId: target.biometricId, recordLabel: target.name, action: 'UPDATE', before, after,
      reason: [`${kind === 'transfer' ? 'Transfer' : 'Manager change'}, effective ${meta.effectiveDate}`, meta.notes].filter(Boolean).join(' - '),
    });
    await conn.query(
      `INSERT INTO employee_mapping_log
         (batch_id, kind, user_id, biometric_id, employee_name, prev_department, new_department,
          prev_reporting_manager_id, prev_reporting_manager_name, new_reporting_manager_id, new_reporting_manager_name,
          prev_hod_id, prev_hod_name, new_hod_id, new_hod_name, effective_date, notes, done_by_biometric_id, done_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batchId, kind, target.id, target.biometricId, target.name, target.department || null, department || null,
        prevRm?.id ?? null, prevRm?.name ?? null, newRm?.id ?? null, newRm?.name ?? null,
        prevHod?.id ?? null, prevHod?.name ?? null, newHod?.id ?? null, newHod?.name ?? null,
        meta.effectiveDate, meta.notes, actor.biometricId, actor.name],
    );
  }
  return batchId;
}

export interface OrderResult { batchId: string; changed: number; unchanged: number; message: string }

/** Moves employees to another department and / or gives them another reporting manager / HoD. */
export async function transferEmployees(req: Request, body: unknown): Promise<OrderResult> {
  const input: TransferInput = parseTransfer(body, todayInIndia());
  return inTransaction(async (conn) => {
    const targets = await lockTargets(conn, input.userIds);
    const names = new Map<string, Person | null>();
    const managers = new Map<string, Person | null>();
    const problems: string[] = [];
    const changes: Change[] = [];
    let unchanged = 0;

    for (const target of targets) {
      if (target.status.toLowerCase() !== 'active') { problems.push(`${target.name}: the account is not active.`); continue; }
      const layout = await layoutOfEmployeeType(conn, target.employmentType);
      const rules = layout ? LAYOUT_RULES[layout] : null;
      const change: Change = { target };

      if (input.department && input.department !== target.department) {
        if (!rules?.department) problems.push(`${target.name}: this employee type has no department to change.`);
        else if (!await activeMasterValue(conn, rules.department, input.department)) problems.push(`${target.name}: "${input.department}" is not an active ${rules.department === 'projects' ? 'project' : 'department'}.`);
        else {
          const [unit] = await rows(conn, "SELECT institute FROM organization_units WHERE name = ? AND UPPER(status) = 'ACTIVE' LIMIT 1", [input.department]);
          if (unit?.institute && target.institute && String(unit.institute) !== target.institute) problems.push(`${target.name}: "${input.department}" belongs to another organization.`);
          else change.department = input.department;
        }
      }
      if (input.reportingManagerId && String(input.reportingManagerId) !== idOf(target.data.reportingManagerId)) {
        const manager = await managerFor(conn, input.reportingManagerId, target.institute, managers);
        if (!manager) problems.push(`${target.name}: choose an active employee of the same organization as the reporting manager.`);
        else change.reportingManager = manager;
      }
      if (input.reviewingManagerId && String(input.reviewingManagerId) !== idOf(target.data.reviewingManagerId)) {
        if (!rules?.hod) problems.push(`${target.name}: this employee type has no HoD.`);
        else {
          const hod = await managerFor(conn, input.reviewingManagerId, target.institute, managers);
          if (!hod) problems.push(`${target.name}: choose an active employee of the same organization as the HoD.`);
          else change.reviewingManager = hod;
        }
      }
      if (change.department === undefined && !change.reportingManager && !change.reviewingManager) unchanged += 1;
      else changes.push(change);
    }
    if (problems.length) throw badRequest(problems.slice(0, 5).join(' ') + (problems.length > 5 ? ` (+${problems.length - 5} more)` : ''), { userIds: problems[0] });
    if (!changes.length) throw badRequest('Nothing to change: the selected employees already have these values.', { userIds: 'No change.' });

    const batchId = await apply(conn, req, 'transfer', changes, input, names);
    return { batchId, changed: changes.length, unchanged, message: `${changes.length} employee${changes.length === 1 ? '' : 's'} transferred${unchanged ? `, ${unchanged} already had these values` : ''}.` };
  });
}

/** Hands the reportees (and / or HoD role) of one manager to another. */
export async function replaceManager(req: Request, body: unknown): Promise<OrderResult> {
  const input: ReplaceInput = parseReplace(body, todayInIndia());
  return inTransaction(async (conn) => {
    const names = new Map<string, Person | null>();
    const outgoing = await personName(conn, String(input.outgoingManagerId), names);
    if (!outgoing) throw badRequest('The outgoing manager was not found.', { outgoingManagerId: 'Choose a person from the list.' });
    const out = String(input.outgoingManagerId);
    const rmWanted = input.scope !== 'reviewing';
    const hodWanted = input.scope !== 'reporting';

    const candidates = await rows(conn,
      `SELECT u.id FROM users u JOIN employee_profiles p ON p.biometric_id = u.biometric_id
        WHERE u.is_system = 0 AND u.id <> ? AND JSON_VALID(p.profile_data)
          AND ((? = 1 AND JSON_UNQUOTE(JSON_EXTRACT(p.profile_data, '$.reportingManagerId')) = ?)
            OR (? = 1 AND JSON_UNQUOTE(JSON_EXTRACT(p.profile_data, '$.reviewingManagerId')) = ?))`,
      [input.outgoingManagerId, rmWanted ? 1 : 0, out, hodWanted ? 1 : 0, out]);
    let ids = candidates.map((r) => Number(r.id));
    if (input.userIds.length) {
      const outside = input.userIds.filter((id) => !ids.includes(id));
      if (outside.length) throw badRequest('Some selected employees do not report to the outgoing manager.', { userIds: 'Choose employees from the list.' });
      ids = input.userIds;
    }
    if (!ids.length) throw badRequest('This manager has no employees to reassign.', { outgoingManagerId: 'No reportees found.' });

    const targets = await lockTargets(conn, ids);
    const managers = new Map<string, Person | null>();
    const problems: string[] = [];
    const changes: Change[] = [];
    for (const target of targets) {
      const incoming = await managerFor(conn, input.incomingManagerId, target.institute, managers);
      if (!incoming) { problems.push(`${target.name}: the incoming manager must be an active employee of the same organization.`); continue; }
      const change: Change = { target };
      // Re-check under the lock: the employee may have been moved since the list was read.
      if (rmWanted && idOf(target.data.reportingManagerId) === out) change.reportingManager = incoming;
      if (hodWanted && idOf(target.data.reviewingManagerId) === out) change.reviewingManager = incoming;
      if (change.reportingManager || change.reviewingManager) changes.push(change);
    }
    if (problems.length) throw badRequest(problems.slice(0, 5).join(' ') + (problems.length > 5 ? ` (+${problems.length - 5} more)` : ''), { incomingManagerId: problems[0] });
    if (!changes.length) throw badRequest('Nothing to change: these employees no longer report to the outgoing manager.', { outgoingManagerId: 'No change.' });

    const batchId = await apply(conn, req, 'manager_change', changes, input, names);
    return { batchId, changed: changes.length, unchanged: 0, message: `${changes.length} employee${changes.length === 1 ? '' : 's'} now report to the incoming manager.` };
  });
}

// ---------------------------------------------------------------------------
// Register and downloads
// ---------------------------------------------------------------------------

export interface MappingLogRow {
  id: string;
  batchId: string;
  kind: 'transfer' | 'manager_change';
  userId: string;
  biometricId: string;
  employeeName: string;
  prevDepartment: string | null;
  newDepartment: string | null;
  prevReportingManager: string | null;
  newReportingManager: string | null;
  prevHod: string | null;
  newHod: string | null;
  effectiveDate: string;
  notes: string | null;
  doneBy: string | null;
  doneByBiometricId: string | null;
  createdAt: string;
}

const MAX_LOG_ROWS = 5000;

function whereFor(f: LogFilter): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.kind) { where.push('kind = ?'); params.push(f.kind); }
  if (f.department) { where.push('(prev_department = ? OR new_department = ?)'); params.push(f.department, f.department); }
  if (f.from) { where.push('effective_date >= ?'); params.push(f.from); }
  if (f.to) { where.push('effective_date <= ?'); params.push(f.to); }
  if (f.search) {
    const term = `%${f.search.replace(/[%_\\]/g, '\\$&')}%`;
    where.push('(employee_name LIKE ? OR biometric_id LIKE ? OR prev_department LIKE ? OR new_department LIKE ? OR new_reporting_manager_name LIKE ? OR prev_reporting_manager_name LIKE ? OR notes LIKE ?)');
    params.push(term, term, term, term, term, term, term);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const dateText = (v: unknown) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v ?? ''));

export async function listMappingLog(f: LogFilter): Promise<{ rows: MappingLogRow[]; truncated: boolean }> {
  const { sql, params } = whereFor(f);
  const found = await rows(pool, `SELECT * FROM employee_mapping_log ${sql} ORDER BY effective_date DESC, id DESC LIMIT ?`, [...params, MAX_LOG_ROWS + 1]);
  const text = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    truncated: found.length > MAX_LOG_ROWS,
    rows: found.slice(0, MAX_LOG_ROWS).map((r) => ({
      id: String(r.id), batchId: String(r.batch_id), kind: r.kind, userId: String(r.user_id), biometricId: String(r.biometric_id),
      employeeName: String(r.employee_name), prevDepartment: text(r.prev_department), newDepartment: text(r.new_department),
      prevReportingManager: text(r.prev_reporting_manager_name), newReportingManager: text(r.new_reporting_manager_name),
      prevHod: text(r.prev_hod_name), newHod: text(r.new_hod_name), effectiveDate: dateText(r.effective_date), notes: text(r.notes),
      doneBy: text(r.done_by_name), doneByBiometricId: text(r.done_by_biometric_id),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    })),
  };
}

const HEADERS = ['Effective date', 'Type', 'Biometric ID', 'Employee', 'From department', 'To department', 'From reporting manager', 'To reporting manager', 'From HoD', 'To HoD', 'Notes', 'Authorized by', 'Recorded at (UTC)'];

/** The register as a table, logged as a download in `format`. */
export async function mappingTable(req: Request, f: LogFilter, format: 'csv' | 'pdf'): Promise<{ headers: string[]; rows: unknown[][] }> {
  const { rows: log } = await listMappingLog(f);
  const out = log.map((r) => [
    r.effectiveDate, r.kind === 'transfer' ? 'Transfer' : 'Manager change', r.biometricId, r.employeeName,
    r.prevDepartment, r.newDepartment, r.prevReportingManager, r.newReportingManager, r.prevHod, r.newHod, r.notes,
    r.doneBy, r.createdAt,
  ]);
  await writeMasterAuditSql(pool, req, {
    masterKey: AUDIT_MAPPING_EXPORT, recordId: 'register', recordLabel: `Employees mapping register (${format.toUpperCase()})`, action: 'EXPORT',
    after: { rows: out.length, format, kind: f.kind, department: f.department, from: f.from, to: f.to, search: f.search },
  });
  return { headers: HEADERS, rows: out };
}

export async function mappingCsv(req: Request, f: LogFilter): Promise<{ filename: string; csv: string }> {
  const { headers, rows: table } = await mappingTable(req, f, 'csv');
  return { filename: `WII_Employee_Mapping_Register_${new Date().toISOString().slice(0, 10)}.csv`, csv: toCsv(headers, table) };
}
