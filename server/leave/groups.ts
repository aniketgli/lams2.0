import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { Validator } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import type { ActivityScope } from '../employees/activity';

/**
 * Leave groups (tables leave_groups and leave_group_types): a named set of leave types and the leave
 * year they follow. An employee belongs to one group (employee form); the group decides which leave
 * types the employee can take and whether the leave year is calendar (CY) or financial (FY).
 * Everyone signed in reads them; only administrators change them. Every change is audited
 * (master_key 'leave_group') in the same transaction. Nothing is pre-filled.
 */

export const LEAVE_YEARS = ['CY', 'FY'] as const;
const AUDIT_KEY = 'leave_group';

export const LEAVE_GROUP_SCOPE: ActivityScope = {
  keys: [AUDIT_KEY, 'leave_group_export'],
  areaLabels: { leave_group: 'Leave group', leave_group_export: 'Log download' },
  exportKey: 'leave_group_export',
  title: 'Leave groups activity log',
  filePrefix: 'WII_Leave_Groups_Activity',
};

export interface LeaveGroup {
  id: string;
  code: string;
  name: string;
  leaveYear: (typeof LEAVE_YEARS)[number];
  leaveTypeIds: string[];
  leaves: Array<{ id: string; code: string; name: string }>;
  status: 'active' | 'inactive';
  /** Employees currently in this group. */
  employeeCount: number;
  updatedAt: string | null;
}

export interface LeaveGroupInput {
  code: string;
  name: string;
  leaveYear: (typeof LEAVE_YEARS)[number];
  leaveTypeIds: string[];
  status: 'active' | 'inactive';
}

type Q = { query: typeof pool.query };

function missingTable(error: unknown): never | void {
  const code = (error as { code?: string })?.code;
  if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') {
    throw new HttpError(503, 'Leave groups are not set up yet. Ask the administrator to run the leave group migration.', 'NOT_CONFIGURED');
  }
}

const label = (g: Pick<LeaveGroup, 'name' | 'code'>) => `${g.name} (${g.code})`;
const reasonOf = (body: unknown) => {
  const r = (body as { reason?: unknown })?.reason;
  return typeof r === 'string' && r.trim() ? r.trim().slice(0, 500) : null;
};

async function employeeCounts(q: Q): Promise<Map<string, number>> {
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT JSON_UNQUOTE(JSON_EXTRACT(profile_data, '$.leaveGroup')) AS code, COUNT(*) AS n FROM employee_profiles
      WHERE JSON_VALID(profile_data) AND JSON_EXTRACT(profile_data, '$.leaveGroup') IS NOT NULL GROUP BY code`);
  return new Map(rows.map((r) => [String(r.code), Number(r.n)]));
}

async function load(q: Q, where = '', params: unknown[] = []): Promise<LeaveGroup[]> {
  const [groups] = await q.query<RowDataPacket[]>(`SELECT id, code, name, leave_year, status, updated_at FROM leave_groups ${where} ORDER BY name`, params);
  if (!groups.length) return [];
  const [links] = await q.query<RowDataPacket[]>(
    `SELECT g.group_id, t.id, t.code, t.name FROM leave_group_types g JOIN leave_types t ON t.id = g.leave_type_id
      WHERE g.group_id IN (${groups.map(() => '?').join(',')}) ORDER BY t.name`, groups.map((g) => Number(g.id)));
  const counts = await employeeCounts(q);
  return groups.map((g) => {
    const leaves = links.filter((l) => Number(l.group_id) === Number(g.id)).map((l) => ({ id: String(l.id), code: String(l.code), name: String(l.name) }));
    return {
      id: String(g.id), code: String(g.code), name: String(g.name), leaveYear: String(g.leave_year) === 'FY' ? 'FY' : 'CY', leaveTypeIds: leaves.map((l) => l.id), leaves,
      status: String(g.status) === 'inactive' ? 'inactive' : 'active', employeeCount: counts.get(String(g.code)) ?? 0,
      updatedAt: g.updated_at ? new Date(g.updated_at).toISOString() : null,
    };
  });
}

export async function listLeaveGroups(): Promise<{ groups: LeaveGroup[]; leaveTypes: Array<{ id: string; code: string; name: string }> }> {
  try {
    const [groups, [types]] = await Promise.all([load(pool), pool.query<RowDataPacket[]>("SELECT id, code, name FROM leave_types WHERE status = 'active' ORDER BY name")]);
    return { groups, leaveTypes: types.map((t) => ({ id: String(t.id), code: String(t.code), name: String(t.name) })) };
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export async function parseLeaveGroupInput(body: unknown): Promise<LeaveGroupInput> {
  const v = new Validator(body);
  const code = v.string('code', { min: 1, max: 20, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'Use letters, numbers, - or _ only.' }).toUpperCase();
  const name = v.string('name', { min: 2, max: 100 }).replace(/\s+/g, ' ');
  const leaveYear = v.oneOf('leaveYear', LEAVE_YEARS);
  const status = v.oneOf('status', ['active', 'inactive'] as const);
  const raw = v.raw('leaveTypeIds');
  let leaveTypeIds: string[] = [];
  if (!Array.isArray(raw) || raw.length === 0) v.errors.leaveTypeIds ||= 'Choose at least one leave type.';
  else {
    leaveTypeIds = [...new Set(raw.map((x) => String(x).trim()))];
    const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM leave_types WHERE status = 'active'");
    const known = new Set(rows.map((r) => String(r.id)));
    if (leaveTypeIds.some((id) => !known.has(id))) v.errors.leaveTypeIds ||= 'Choose active leave types from the list.';
  }
  v.assert();
  return { code, name, leaveYear: leaveYear!, leaveTypeIds, status: status! };
}

const auditView = (g: LeaveGroupInput | LeaveGroup): Record<string, unknown> => ({
  code: g.code, name: g.name, leaveYear: g.leaveYear, status: g.status,
  leaveTypes: [...g.leaveTypeIds].sort((a, b) => Number(a) - Number(b)),
});

function duplicate(error: unknown): never | void {
  if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
    const msg = String((error as { sqlMessage?: string }).sqlMessage ?? '');
    const field = msg.includes('uq_leave_groups_name') ? 'name' : 'code';
    throw new HttpError(409, `A leave group with this ${field} already exists.`, 'DUPLICATE', { [field]: `This ${field} is already used by another leave group.` });
  }
}

async function saveLeaves(conn: Q, id: number, typeIds: string[]): Promise<void> {
  await conn.query('DELETE FROM leave_group_types WHERE group_id = ?', [id]);
  for (const t of typeIds) await conn.query('INSERT INTO leave_group_types (group_id, leave_type_id) VALUES (?, ?)', [id, Number(t)]);
}

export async function createLeaveGroup(req: Request, body: unknown): Promise<LeaveGroup> {
  const input = await parseLeaveGroupInput(body);
  try {
    return await inTransaction(async (conn) => {
      const [result] = await conn.query('INSERT INTO leave_groups (code, name, leave_year, status) VALUES (?, ?, ?, ?)', [input.code, input.name, input.leaveYear, input.status]);
      const id = Number((result as { insertId: number }).insertId);
      await saveLeaves(conn, id, input.leaveTypeIds);
      const [created] = await load(conn, 'WHERE id = ?', [id]);
      await writeMasterAuditSql(conn as never, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(created), action: 'CREATE', after: auditView(input), reason: reasonOf(body) });
      return created;
    });
  } catch (error) {
    missingTable(error);
    duplicate(error);
    throw error;
  }
}

async function lock(conn: Q, id: number): Promise<LeaveGroup> {
  const [rows] = await conn.query<RowDataPacket[]>('SELECT id FROM leave_groups WHERE id = ? FOR UPDATE', [id]);
  if (!rows[0]) throw notFound('Leave group not found.');
  const [group] = await load(conn, 'WHERE id = ?', [id]);
  return group;
}

export async function updateLeaveGroup(req: Request, id: number, body: unknown): Promise<LeaveGroup> {
  const input = await parseLeaveGroupInput(body);
  try {
    return await inTransaction(async (conn) => {
      const before = await lock(conn, id);
      if (before.employeeCount > 0) {
        if (before.code !== input.code) throw new HttpError(409, `${before.employeeCount} employee(s) are in this leave group, so its code cannot change.`, 'IN_USE', { code: 'The code cannot change while employees are in this group.' });
        if (before.leaveYear !== input.leaveYear) throw new HttpError(409, `${before.employeeCount} employee(s) are in this leave group, so its leave year cannot change.`, 'IN_USE', { leaveYear: 'The leave year cannot change while employees are in this group.' });
      }
      await conn.query('UPDATE leave_groups SET code = ?, name = ?, leave_year = ?, status = ? WHERE id = ?', [input.code, input.name, input.leaveYear, input.status, id]);
      await saveLeaves(conn, id, input.leaveTypeIds);
      const [updated] = await load(conn, 'WHERE id = ?', [id]);
      const beforeView = auditView(before);
      const afterView = auditView(updated);
      if (changedFields(beforeView, afterView).length) {
        await writeMasterAuditSql(conn as never, req, {
          masterKey: AUDIT_KEY, recordId: id, recordLabel: label(updated), action: before.status !== updated.status ? 'STATUS' : 'UPDATE',
          before: beforeView, after: afterView, reason: reasonOf(body),
        });
      }
      return updated;
    });
  } catch (error) {
    missingTable(error);
    duplicate(error);
    throw error;
  }
}

export async function deleteLeaveGroup(req: Request, id: number, reason: string | null): Promise<void> {
  try {
    await inTransaction(async (conn) => {
      const before = await lock(conn, id);
      if (before.employeeCount > 0) throw new HttpError(409, `${before.employeeCount} employee(s) are in this leave group. Move them to another group, or make this group Inactive.`, 'IN_USE');
      await conn.query('DELETE FROM leave_group_types WHERE group_id = ?', [id]);
      await conn.query('DELETE FROM leave_groups WHERE id = ?', [id]);
      await writeMasterAuditSql(conn as never, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: label(before), action: 'DELETE', before: auditView(before), reason });
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Leave types an employee of this group can take; null when the employee has no group (earlier employees), so nothing is restricted. */
export async function groupLeaveTypeIds(q: Q, groupCode: unknown): Promise<Set<number> | null> {
  if (typeof groupCode !== 'string' || !groupCode) return null;
  try {
    const [rows] = await q.query<RowDataPacket[]>(
      'SELECT t.leave_type_id FROM leave_groups g JOIN leave_group_types t ON t.group_id = g.id WHERE g.code = ?', [groupCode]);
    return new Set(rows.map((r) => Number(r.leave_type_id)));
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') return null;
    throw error;
  }
}

/** All groups at once (group code -> leave type ids), for screens that list many employees. */
export async function groupLeaveTypeMap(q: Q): Promise<Map<string, Set<number>>> {
  const out = new Map<string, Set<number>>();
  try {
    const [rows] = await q.query<RowDataPacket[]>('SELECT g.code, t.leave_type_id FROM leave_groups g JOIN leave_group_types t ON t.group_id = g.id');
    for (const r of rows) {
      const code = String(r.code);
      out.set(code, (out.get(code) ?? new Set()).add(Number(r.leave_type_id)));
    }
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return out;
}

/** Leave types a signed-in employee can take (null = not restricted: no group). */
export async function groupLeaveTypeIdsOfUser(q: Q, userId: number): Promise<Set<number> | null> {
  const [rows] = await q.query<RowDataPacket[]>(
    'SELECT p.profile_data FROM users u JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1', [userId]);
  if (!rows[0]) return null;
  let code: unknown = null;
  try { code = JSON.parse(String(rows[0].profile_data || '{}'))?.leaveGroup; } catch { code = null; }
  return groupLeaveTypeIds(q, code);
}
