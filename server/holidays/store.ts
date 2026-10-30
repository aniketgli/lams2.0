import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { Validator } from '../lib/validate';
import { changedFields, writeMasterAuditSql } from '../masters/audit';
import type { ActivityScope } from '../employees/activity';

/**
 * Holiday calendar (table `holidays`). Everyone signed in reads it; only
 * administrators change it, and every change is audited (master_key 'holiday').
 * Day of week and "long weekend" are worked out here from the date, never typed.
 */

export const HOLIDAY_TYPES = ['gazetted', 'restricted', 'local'] as const;
export const HOLIDAY_CATEGORIES = ['National', 'Religious', 'Cultural', 'Institutional', 'International', 'Other'] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

const AUDIT_KEY = 'holiday';

/** The auditor's holiday activity log: holiday changes and downloads of that log. */
export const HOLIDAY_SCOPE: ActivityScope = {
  keys: ['holiday', 'holiday_export'],
  areaLabels: { holiday: 'Holiday', holiday_export: 'Log download' },
  exportKey: 'holiday_export',
  title: 'Holiday activity log',
  filePrefix: 'WII_Holiday_Activity',
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface Holiday {
  id: string;
  date: string;
  name: string;
  hindiName: string | null;
  type: HolidayType;
  category: string;
  description: string | null;
  dayOfWeek: string;
  year: number;
  month: number;
  /** Friday or Monday: joins a weekend into three days off. */
  isLongWeekend: boolean;
  updatedAt: string | null;
}

export interface HolidayInput {
  date: string;
  name: string;
  hindiName: string | null;
  type: HolidayType;
  category: string;
  description: string | null;
}

function dateOnly(value: unknown): string {
  if (value instanceof Date) {
    // DATE columns arrive as local-midnight Dates; read the calendar date, not UTC.
    const y = value.getFullYear(), m = value.getMonth() + 1, d = value.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

/** Day name and long-weekend flag for a YYYY-MM-DD date. */
export function describeDate(date: string): { dayOfWeek: string; isLongWeekend: boolean; year: number; month: number } {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { dayOfWeek: DAYS[day], isLongWeekend: day === 1 || day === 5, year: y, month: m };
}

function toHoliday(row: RowDataPacket): Holiday {
  const date = dateOnly(row.holiday_date);
  return {
    id: String(row.id),
    date,
    name: String(row.name),
    hindiName: row.hindi_name ? String(row.hindi_name) : null,
    type: String(row.type) as HolidayType,
    category: String(row.category),
    description: row.description ? String(row.description) : null,
    ...describeDate(date),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/** What the audit trail records for a holiday. */
function auditView(h: Pick<Holiday, 'date' | 'name' | 'hindiName' | 'type' | 'category' | 'description'>): Record<string, unknown> {
  return { date: h.date, name: h.name, hindiName: h.hindiName, type: h.type, category: h.category, description: h.description };
}

export function parseHolidayInput(body: unknown): HolidayInput {
  const v = new Validator(body);
  const date = v.date('date');
  const name = v.string('name', { min: 2, max: 150 }).replace(/\s+/g, ' ');
  const hindiName = v.optionalString('hindiName', { max: 150 });
  const type = v.oneOf('type', HOLIDAY_TYPES);
  const category = v.oneOf('category', HOLIDAY_CATEGORIES);
  const description = v.optionalString('description', { max: 500 });
  if (date) {
    const year = Number(date.slice(0, 4));
    if (year < 2000 || year > 2100) v.errors.date ||= 'Choose a date between 2000 and 2100.';
  }
  v.assert();
  return { date: date!, name, hindiName, type: type!, category: category!, description };
}

export async function listHolidays(year: number | null): Promise<Holiday[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM holidays ${year ? 'WHERE holiday_date >= ? AND holiday_date < ?' : ''} ORDER BY holiday_date, name`,
      year ? [`${year}-01-01`, `${year + 1}-01-01`] : [],
    );
    return rows.map(toHoliday);
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
      throw new HttpError(503, 'The holiday calendar is not set up yet. Ask the administrator to run the holidays migration.', 'NOT_CONFIGURED');
    }
    throw error;
  }
}

/** Years that have holidays, newest first (for the year picker). */
export async function holidayYears(): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT DISTINCT YEAR(holiday_date) AS y FROM holidays ORDER BY y DESC');
  return rows.map((r) => Number(r.y)).filter(Number.isFinite);
}

function duplicateError(input: HolidayInput): HttpError {
  return new HttpError(409, 'This holiday already exists on that date.', 'DUPLICATE', { name: `"${input.name}" is already listed on ${input.date}.` });
}

async function findDuplicate(conn: { query: typeof pool.query }, input: HolidayInput, selfId: number | null): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id FROM holidays WHERE holiday_date = ? AND LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
    [input.date, input.name, selfId ?? 0],
  );
  return rows.length > 0;
}

const isDup = (e: unknown) => (e as { code?: string })?.code === 'ER_DUP_ENTRY';

export async function createHoliday(req: Request, body: unknown): Promise<Holiday> {
  const input = parseHolidayInput(body);
  const actor = req.auth!.account.biometricId;
  try {
    return await inTransaction(async (conn) => {
      if (await findDuplicate(conn, input, null)) throw duplicateError(input);
      const [result] = await conn.query(
        `INSERT INTO holidays (holiday_date, name, hindi_name, type, category, description, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.date, input.name, input.hindiName, input.type, input.category, input.description, actor, actor],
      );
      const id = Number((result as { insertId: number }).insertId);
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM holidays WHERE id = ?', [id]);
      const created = toHoliday(rows[0]);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: `${created.name} (${created.date})`, action: 'CREATE', after: auditView(created) });
      return created;
    });
  } catch (error) {
    if (isDup(error)) throw duplicateError(input);
    throw error;
  }
}

export async function updateHoliday(req: Request, id: number, body: unknown): Promise<{ holiday: Holiday; changed: string[] }> {
  const input = parseHolidayInput(body);
  const actor = req.auth!.account.biometricId;
  try {
    return await inTransaction(async (conn) => {
      const [found] = await conn.query<RowDataPacket[]>('SELECT * FROM holidays WHERE id = ? FOR UPDATE', [id]);
      if (!found[0]) throw notFound('Holiday not found.');
      const before = toHoliday(found[0]);
      const changed = changedFields(auditView(before), auditView({ ...input }));
      if (changed.length === 0) return { holiday: before, changed };
      if (await findDuplicate(conn, input, id)) throw duplicateError(input);
      await conn.query(
        'UPDATE holidays SET holiday_date = ?, name = ?, hindi_name = ?, type = ?, category = ?, description = ?, updated_by = ? WHERE id = ?',
        [input.date, input.name, input.hindiName, input.type, input.category, input.description, actor, id],
      );
      const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM holidays WHERE id = ?', [id]);
      const after = toHoliday(rows[0]);
      await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: `${after.name} (${after.date})`, action: 'UPDATE', before: auditView(before), after: auditView(after) });
      return { holiday: after, changed };
    });
  } catch (error) {
    if (isDup(error)) throw duplicateError(input);
    throw error;
  }
}

export async function deleteHoliday(req: Request, id: number, reason: string | null): Promise<Holiday> {
  return inTransaction(async (conn) => {
    const [found] = await conn.query<RowDataPacket[]>('SELECT * FROM holidays WHERE id = ? FOR UPDATE', [id]);
    if (!found[0]) throw notFound('Holiday not found.');
    const target = toHoliday(found[0]);
    await conn.query('DELETE FROM holidays WHERE id = ?', [id]);
    await writeMasterAuditSql(conn, req, { masterKey: AUDIT_KEY, recordId: id, recordLabel: `${target.name} (${target.date})`, action: 'DELETE', before: auditView(target), reason });
    return target;
  });
}

export function holidayId(raw: unknown): number {
  const value = String(raw ?? '').trim();
  if (!/^\d{1,20}$/.test(value)) throw badRequest('Invalid holiday ID.');
  return Number(value);
}
