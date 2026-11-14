import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, forbidden } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { Validator, todayInIndia } from '../lib/validate';
import { writeMasterAuditSql } from '../masters/audit';
import {
  BALANCE_KEY, type Employee, type Policy, type Viewer, balanceAsOn, balanceOf, creditedQuota, cycleLabel, daysFrom, eligibilityProblem, listBalances, loadEmployee, loadPolicy, missingTable, num, writeGrant,
} from './requests';
import { canManageBalances } from '../lib/roles';

/**
 * Leave quota import (administrator / Leave Balance Manager). A CSV with Biometric_ID, Leave_Year (CY 2026 / FY 2026-27),
 * Leave_Code, Total_Quota and, optionally, As_On sets, adds to or deducts from the balance of the leave year named in each row.
 * "Set" makes it the balance as on As_On (default today): leaves before that date are already in it and are not deducted
 * again. "Add" / "Deduct" keep the date already stored. The browser first asks for a review (nothing is
 * written); importing re-checks every row on the server and writes all of them in one transaction, or
 * none when a single row has a problem. Each changed balance is audited like a manual change.
 */

export const IMPORT_STRATEGIES = ['set', 'add', 'deduct'] as const;
export type ImportStrategy = (typeof IMPORT_STRATEGIES)[number];
export const MAX_IMPORT_ROWS = 3000;
export const IMPORT_HEADERS = ['Biometric_ID', 'Leave_Year', 'Leave_Code', 'Total_Quota'] as const;
/** Optional column: the date the balance is set as on (DD-MM-YYYY or YYYY-MM-DD; empty = today). */
export const AS_ON_HEADER = 'As_On';

/** "31-01-2026", "31/01/2026" or "2026-01-31" → "2026-01-31"; '' when empty; null when it is not a date. */
export function parseAsOn(text: string): string | null | '' {
  const t = text.trim();
  if (!t) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const iso = m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    : (m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t)) ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** "CY 2026" / "FY 2026-27" (or FY 2026-2027) → the cycle and the year it starts; null when the text is neither. */
export function parseLeaveYear(text: string): { type: 'CY' | 'FY'; year: number } | null {
  const m = /^(CY|FY)\s*(\d{4})(?:\s*-\s*(\d{2}|\d{4}))?$/i.exec(text.trim());
  if (!m) return null;
  const type = m[1].toUpperCase() as 'CY' | 'FY', year = Number(m[2]);
  if (year < 2000 || year > 2100) return null;
  if (type === 'CY') return m[3] ? null : { type, year };
  if (!m[3]) return null;
  const end = m[3].length === 2 ? Math.floor(year / 100) * 100 + Number(m[3]) : Number(m[3]);
  return end === year + 1 ? { type, year } : null;
}
const MAX_CSV_CHARS = 1_000_000;
const STRATEGY_LABEL: Record<ImportStrategy, string> = { set: 'Set quota', add: 'Add', deduct: 'Deduct' };

type Q = { query: typeof pool.query };

/** Splits CSV / tab / semicolon text into rows of cells; quoted cells may hold the delimiter and line breaks. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const out: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const endRow = () => { row.push(cell); cell = ''; if (row.some((c) => c.trim() !== '')) out.push(row); row = []; };
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n') endRow();
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) endRow();
  return out;
}

const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface ImportRow {
  line: number; biometricId: string; employee: string; cycle: string; leaveCode: string; leaveType: string; value: string;
  before: number | null; after: number | null; status: 'ok' | 'unchanged' | 'error'; error: string | null;
}
export interface ImportReview {
  strategy: ImportStrategy;
  summary: { rows: number; ok: number; unchanged: number; errors: number };
  rows: ImportRow[];
}
interface Planned { row: ImportRow; year: number; emp: Employee; policy: Policy; carryForward: number; total: number; asOf?: string; before: { total: number; carryForward: number } }

function parseInput(body: unknown, admin: boolean): { strategy: ImportStrategy; csv: string } {
  if (!admin) throw forbidden('Only an administrator or Leave Balance Manager can import leave quotas.');
  const v = new Validator(body);
  const strategy = v.oneOf('strategy', IMPORT_STRATEGIES);
  const csv = v.string('csv', { min: 1, max: MAX_CSV_CHARS });
  v.assert();
  return { strategy: strategy!, csv };
}

/** Checks every row against the database. Writes nothing. */
async function plan(q: Q, input: { strategy: ImportStrategy; csv: string }): Promise<{ review: ImportReview; planned: Planned[] }> {
  const table = parseDelimited(input.csv);
  if (table.length === 0) throw badRequest('The file is empty.', { csv: 'The file is empty.' });
  const heads = table[0].map(key);
  const col = (name: string) => heads.indexOf(key(name));
  const [cBio, cCycle, cCode, cQuota] = IMPORT_HEADERS.map(col);
  const cAsOn = col(AS_ON_HEADER);
  const missing = IMPORT_HEADERS.filter((_, i) => [cBio, cCycle, cCode, cQuota][i] === -1);
  if (missing.length) throw badRequest(`Missing column: ${missing.join(', ')}.`, { csv: `The first row must have the columns ${IMPORT_HEADERS.join(', ')}. Missing: ${missing.join(', ')}.` });
  const body = table.slice(1);
  if (body.length === 0) throw badRequest('The file has no data rows.', { csv: 'The file has a header but no data rows.' });
  if (body.length > MAX_IMPORT_ROWS) throw badRequest(`At most ${MAX_IMPORT_ROWS} rows can be imported at once.`, { csv: `The file has ${body.length} rows; at most ${MAX_IMPORT_ROWS} can be imported at once.` });

  const types = new Map<string, Policy>();
  const [typeRows] = await q.query<RowDataPacket[]>("SELECT id FROM leave_types WHERE status = 'active'");
  for (const t of typeRows) { const p = await loadPolicy(q, Number(t.id)); if (p) types.set(p.code.toUpperCase(), p); }
  const people = new Map<string, { id: number; name: string } | null>();
  const employees = new Map<number, Employee>();
  const seen = new Map<string, number>();
  const today = todayInIndia();
  const planned: Planned[] = [];
  const rowsOut: ImportRow[] = [];

  for (let i = 0; i < body.length; i++) {
    const cells = body[i];
    const line = i + 2;
    const biometricId = (cells[cBio] ?? '').trim(), leaveCode = (cells[cCode] ?? '').trim(), value = (cells[cQuota] ?? '').trim();
    const cycleText = (cells[cCycle] ?? '').trim();
    const row: ImportRow = { line, biometricId, employee: '', cycle: cycleText, leaveCode, leaveType: '', value, before: null, after: null, status: 'error', error: null };
    rowsOut.push(row);
    const fail = (message: string) => { row.error = message; };

    if (!biometricId) { fail('Biometric_ID is empty.'); continue; }
    if (!leaveCode) { fail('Leave_Code is empty.'); continue; }
    if (!people.has(biometricId)) {
      const [found] = await q.query<RowDataPacket[]>("SELECT id, name FROM users WHERE biometric_id = ? AND LOWER(status) = 'active' AND is_system = 0 LIMIT 1", [biometricId]);
      people.set(biometricId, found[0] ? { id: Number(found[0].id), name: String(found[0].name) } : null);
    }
    const person = people.get(biometricId);
    if (!person) { fail(`No active employee has the Biometric_ID ${biometricId}.`); continue; }
    row.employee = person.name;
    const policy = types.get(leaveCode.toUpperCase());
    if (!policy) { fail(`${leaveCode} is not an active leave type.`); continue; }
    row.leaveType = policy.name;
    if (!policy.debited) { fail(`${policy.name} has no balance (it is not debited), so it has no quota.`); continue; }
    const when = parseLeaveYear(cycleText);
    if (!when) { fail('Leave_Year must be like CY 2026 or FY 2026-27.'); continue; }
    row.cycle = when.type === 'FY' ? cycleLabel(when.year, 'FY') : `CY ${when.year}`;
    const quota = Number(value);
    if (value === '' || !Number.isFinite(quota) || quota < 0 || quota > 400 || Math.round(quota * 2) !== quota * 2) { fail('Total_Quota must be days from 0 to 400, in steps of 0.5.'); continue; }
    const dup = `${person.id}:${policy.id}:${when.type}${when.year}`;
    if (seen.has(dup)) { fail(`Repeated: line ${seen.get(dup)} has the same employee and leave type.`); continue; }
    seen.set(dup, line);

    let emp = employees.get(person.id);
    if (!emp) {
      try { emp = await loadEmployee(q, person.id); } catch (error) { if (error instanceof HttpError) { fail('This employee cannot be loaded.'); continue; } throw error; }
      employees.set(person.id, emp);
    }
    if (emp.basis !== when.type) { fail(`${person.name} follows ${emp.basis === 'FY' ? 'the financial year (FY)' : 'the calendar year (CY)'}, not ${when.type}.`); continue; }
    const problem = eligibilityProblem(policy, emp, `${when.year}-12-31`);
    if (problem) { fail(problem); continue; }
    const before = await balanceOf(q, emp.id, { id: policy.id, quota: creditedQuota(policy, emp.employmentType, when.year, emp.basis, today, emp.isPwd) }, when.year);
    // "Set": the balance as on As_On (default today), clamped into the leave year. Leaves before it are already in it.
    let asOf: string | undefined;
    if (input.strategy === 'set') {
      const given = cAsOn >= 0 ? parseAsOn(cells[cAsOn] ?? '') : '';
      if (given === null) { fail('As_On must be a date like 31-01-2026 (or leave it empty for today).'); continue; }
      asOf = balanceAsOn(when.year, emp.basis, given || today);
    }
    const total = input.strategy === 'set' ? quota : input.strategy === 'add' ? before.total + quota : before.total - quota;
    row.before = before.total; row.after = num(total);
    if (total < 0) { fail(`Deducting ${quota} from ${num(before.total)} would go below 0.`); continue; }
    if (total > 400) { fail('The total cannot be more than 400 days.'); continue; }
    const counted = asOf ? await daysFrom(q, emp.id, policy.id, when.year, asOf) : before.used + before.pending;
    if (total + before.carryForward < counted) {
      fail(asOf ? `Leaves from ${asOf} on already use or wait for ${num(counted)} days; the balance cannot be lower.` : `Days already used or pending are ${num(counted)}; the balance cannot be lower.`);
      continue;
    }
    row.status = num(total) === num(before.total) && (!asOf || asOf === before.asOf) ? 'unchanged' : 'ok';
    planned.push({ row, year: when.year, emp, policy, carryForward: before.carryForward, total: num(total), asOf, before: { total: before.total, carryForward: before.carryForward } });
  }
  const count = (s: ImportRow['status']) => rowsOut.filter((r) => r.status === s).length;
  return {
    review: { strategy: input.strategy, summary: { rows: rowsOut.length, ok: count('ok'), unchanged: count('unchanged'), errors: count('error') }, rows: rowsOut },
    planned,
  };
}

/** What the import would do, row by row. Never writes. */
export async function reviewImport(viewer: { role: string | null }, body: unknown): Promise<ImportReview> {
  const input = parseInput(body, canManageBalances(viewer.role));
  try {
    return (await plan(pool, input)).review;
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Writes the import. Every row is checked again; one problem row stops the whole import. */
export async function applyImport(req: Request, viewer: { role: string | null }, body: unknown): Promise<ImportReview> {
  const input = parseInput(body, canManageBalances(viewer.role));
  try {
    return await inTransaction(async (conn) => {
      const { review, planned } = await plan(conn, input);
      if (review.summary.errors) {
        throw new HttpError(400, `${review.summary.errors} row(s) have problems. Nothing was imported; fix the file and review again.`, 'IMPORT_INVALID', { csv: `${review.summary.errors} row(s) have problems.` });
      }
      for (const p of planned.filter((x) => x.row.status === 'ok')) {
        await writeGrant(conn, { userId: p.emp.id, typeId: p.policy.id, year: p.year, total: p.total, carryForward: p.carryForward, basis: p.emp.basis, asOf: p.asOf });
        await writeMasterAuditSql(conn, req, {
          masterKey: BALANCE_KEY, recordId: `${p.emp.id}:${p.policy.id}:${p.year}`,
          recordLabel: `${p.row.employee} (${p.row.biometricId}) · ${p.policy.code} · ${p.row.cycle}`,
          action: 'UPDATE', before: p.before, after: { total: p.total, carryForward: p.carryForward, ...(p.asOf ? { asOn: p.asOf } : {}) },
          reason: `CSV import: ${STRATEGY_LABEL[input.strategy]} (line ${p.row.line})`,
        });
      }
      return review;
    });
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

export const TEMPLATE_CYCLES = ['all', 'CY', 'FY'] as const;

/**
 * The rows of the import file for one leave year, taken from the database: every active employee of the
 * chosen cycle with every leave type that has a balance for them, and the days granted today.
 */
export async function importTemplate(viewer: Viewer, yearRaw: unknown, cycleRaw: unknown): Promise<{ year: number; headers: string[]; rows: Array<Array<string | number>> }> {
  if (!canManageBalances(viewer.role)) throw forbidden('Only an administrator or Leave Balance Manager can import leave quotas.');
  const cycle = cycleRaw === undefined || cycleRaw === '' ? 'all' : String(cycleRaw);
  if (!(TEMPLATE_CYCLES as readonly string[]).includes(cycle)) throw badRequest('Choose All, CY or FY.');
  const list = await listBalances(viewer, yearRaw);
  const types = list.types.filter((t) => t.isDebited);
  const rows = list.rows.filter((r) => cycle === 'all' || r.basis === cycle)
    // As_On is filled with the date the balance was set as on (or the first day of the leave year when it never was),
    // so a template sent back unchanged changes nothing. A new balance typed in gets today's date or the date it is as on.
    .flatMap((r) => types.filter((t) => r.balances[t.id]).map((t) => {
      const b = r.balances[t.id]!;
      const start = r.basis === 'FY' ? `${list.year}-04-01` : `${list.year}-01-01`;
      const asOn = b.asOf ?? start;
      return [r.biometricId, r.basis === 'FY' ? cycleLabel(list.year, 'FY') : `CY ${list.year}`, t.code, b.total, `${asOn.slice(8, 10)}-${asOn.slice(5, 7)}-${asOn.slice(0, 4)}`];
    }));
  return { year: list.year, headers: [...IMPORT_HEADERS, AS_ON_HEADER], rows };
}
