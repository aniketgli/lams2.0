import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, forbidden } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { Validator, todayInIndia } from '../lib/validate';
import { writeMasterAuditSql } from '../masters/audit';
import {
  BALANCE_KEY, type Employee, type Policy, type Viewer, balanceOf, creditedQuota, cycleLabel, eligibilityProblem, listBalances, loadEmployee, loadPolicy, missingTable, num,
} from './requests';

/**
 * Leave quota import (administrator). A CSV with Biometric_ID, Leave_Year (CY 2026 / FY 2026-27), Leave_Code and Total_Quota sets, adds to
 * or deducts from the days granted for the leave year named in each row. The browser first asks for a review (nothing is
 * written); importing re-checks every row on the server and writes all of them in one transaction, or
 * none when a single row has a problem. Each changed balance is audited like a manual change.
 */

export const IMPORT_STRATEGIES = ['set', 'add', 'deduct'] as const;
export type ImportStrategy = (typeof IMPORT_STRATEGIES)[number];
export const MAX_IMPORT_ROWS = 3000;
export const IMPORT_HEADERS = ['Biometric_ID', 'Leave_Year', 'Leave_Code', 'Total_Quota'] as const;

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
interface Planned { row: ImportRow; year: number; emp: Employee; policy: Policy; carryForward: number; total: number; before: { total: number; carryForward: number } }

function parseInput(body: unknown, admin: boolean): { strategy: ImportStrategy; csv: string } {
  if (!admin) throw forbidden('Only an administrator can import leave quotas.');
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
      const [found] = await q.query<RowDataPacket[]>("SELECT id, name FROM users WHERE biometric_id = ? AND LOWER(status) = 'active' LIMIT 1", [biometricId]);
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
    const total = input.strategy === 'set' ? quota : input.strategy === 'add' ? before.total + quota : before.total - quota;
    row.before = before.total; row.after = num(total);
    if (total < 0) { fail(`Deducting ${quota} from ${num(before.total)} would go below 0.`); continue; }
    if (total > 400) { fail('The total cannot be more than 400 days.'); continue; }
    if (total + before.carryForward < before.used + before.pending) { fail(`Days already used or pending are ${num(before.used + before.pending)}; the grant cannot be lower.`); continue; }
    row.status = num(total) === num(before.total) ? 'unchanged' : 'ok';
    planned.push({ row, year: when.year, emp, policy, carryForward: before.carryForward, total: num(total), before: { total: before.total, carryForward: before.carryForward } });
  }
  const count = (s: ImportRow['status']) => rowsOut.filter((r) => r.status === s).length;
  return {
    review: { strategy: input.strategy, summary: { rows: rowsOut.length, ok: count('ok'), unchanged: count('unchanged'), errors: count('error') }, rows: rowsOut },
    planned,
  };
}

/** What the import would do, row by row. Never writes. */
export async function reviewImport(viewer: { role: string | null }, body: unknown): Promise<ImportReview> {
  const input = parseInput(body, viewer.role === 'administrator');
  try {
    return (await plan(pool, input)).review;
  } catch (error) {
    missingTable(error);
    throw error;
  }
}

/** Writes the import. Every row is checked again; one problem row stops the whole import. */
export async function applyImport(req: Request, viewer: { role: string | null }, body: unknown): Promise<ImportReview> {
  const input = parseInput(body, viewer.role === 'administrator');
  try {
    return await inTransaction(async (conn) => {
      const { review, planned } = await plan(conn, input);
      if (review.summary.errors) {
        throw new HttpError(400, `${review.summary.errors} row(s) have problems. Nothing was imported; fix the file and review again.`, 'IMPORT_INVALID', { csv: `${review.summary.errors} row(s) have problems.` });
      }
      for (const p of planned.filter((x) => x.row.status === 'ok')) {
        await conn.query(
          `INSERT INTO leave_balances (user_id, leave_type_id, cycle_year, total, carry_forward, cycle_type) VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE total = VALUES(total), carry_forward = VALUES(carry_forward), cycle_type = VALUES(cycle_type)`,
          [p.emp.id, p.policy.id, p.year, p.total, p.carryForward, p.emp.basis],
        );
        await writeMasterAuditSql(conn, req, {
          masterKey: BALANCE_KEY, recordId: `${p.emp.id}:${p.policy.id}:${p.year}`,
          recordLabel: `${p.row.employee} (${p.row.biometricId}) · ${p.policy.code} · ${p.row.cycle}`,
          action: 'UPDATE', before: p.before, after: { total: p.total, carryForward: p.carryForward },
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
  if (viewer.role !== 'administrator') throw forbidden('Only an administrator can import leave quotas.');
  const cycle = cycleRaw === undefined || cycleRaw === '' ? 'all' : String(cycleRaw);
  if (!(TEMPLATE_CYCLES as readonly string[]).includes(cycle)) throw badRequest('Choose All, CY or FY.');
  const list = await listBalances(viewer, yearRaw);
  const types = list.types.filter((t) => t.isDebited);
  const rows = list.rows.filter((r) => cycle === 'all' || r.basis === cycle)
    .flatMap((r) => types.filter((t) => r.balances[t.id]).map((t) => [r.biometricId, r.basis === 'FY' ? cycleLabel(list.year, 'FY') : `CY ${list.year}`, t.code, r.balances[t.id]!.total]));
  return { year: list.year, headers: [...IMPORT_HEADERS], rows };
}
