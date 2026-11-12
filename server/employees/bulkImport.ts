import type { Request } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { pool } from '../../src/db';
import { HttpError, badRequest } from '../lib/http';
import { generateTemporaryPassword, passwordProblem } from '../lib/passwordPolicy';
import { inTransaction } from '../lib/tx';
import { Validator } from '../lib/validate';
import { parseDelimited } from '../leave/balanceImport';
import { defaultPasswordHash } from '../masters/accountSettings';
import { CADRES, LAYOUT_RULES, RECRUITMENT_CATEGORIES, type FormLayout } from './fields';
import { MAX_EMPLOYEE_IMPORT_ROWS, columnsFor, creationOrder, parseDay, parseYesNo, type ImportColumn } from './bulkImportRules';

export { MAX_EMPLOYEE_IMPORT_ROWS } from './bulkImportRules';
import { layoutOfEmployeeType } from './references';
import { insertEmployee } from './store';

/**
 * Bulk import of new employees, one employee type per file (the type decides the columns, like the form).
 *
 *  1. Template: the columns of that type's form, a hint line (starts with #, skipped on import) and the
 *     values each master column accepts.
 *  2. Review: every row is created inside a transaction with every check of the "New employee" form, then
 *     the transaction is rolled back. So the review sees exactly what the import would: duplicate IDs /
 *     emails / mobiles (also inside the file), masters, managers (also ones added earlier in the same file).
 *  3. Import: the same, committed only when no row has a problem (all or nothing). Each new account gets
 *     the HRMS User role and must choose its own password at first sign-in.
 */

const MAX_CSV_CHARS = 2_000_000;

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

type Q = Pick<PoolConnection, 'query'> | typeof pool;
async function rows(q: Q, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await q.query<RowDataPacket[]>(sql, params);
  return result;
}

export interface ImportType { code: string; name: string; layout: FormLayout }

/** Active employee types that have a form layout. */
export async function importTypes(): Promise<ImportType[]> {
  const list = await rows(pool, "SELECT code, name FROM lookup_values WHERE lookup_type = 'employee_type' AND UPPER(status) = 'ACTIVE' ORDER BY sort_order, name");
  const out: ImportType[] = [];
  for (const t of list) {
    const layout = await layoutOfEmployeeType(pool, String(t.code));
    if (layout) out.push({ code: String(t.code), name: String(t.name), layout });
  }
  return out;
}

async function typeOf(code: unknown): Promise<ImportType> {
  const type = (await importTypes()).find((t) => t.code === String(code ?? ''));
  if (!type) throw badRequest('Choose an active employee type.', { employmentType: 'Choose an active employee type.' });
  return type;
}

/** Values a master column accepts, for the template's second file. */
async function allowedValues(type: ImportType): Promise<Record<string, string[]>> {
  const rules = LAYOUT_RULES[type.layout];
  const names = async (table: string) => (await rows(pool, `SELECT name FROM ${table} WHERE UPPER(status) = 'ACTIVE' ORDER BY name`)).map((r) => String(r.name));
  const lookup = async (t: string) => (await rows(pool, "SELECT name FROM lookup_values WHERE lookup_type = ? AND UPPER(status) = 'ACTIVE' ORDER BY sort_order, name", [t])).map((r) => String(r.name));
  const out: Record<string, string[]> = {
    Salutation: await lookup('salutation'),
    Gender: await lookup('gender'),
    Institute: await lookup('institute'),
    Shift: (await rows(pool, "SELECT name FROM shifts WHERE LOWER(status) = 'active' ORDER BY name")).map((r) => String(r.name)),
    Leave_Group: (await rows(pool, "SELECT code, name FROM leave_groups WHERE status = 'active' ORDER BY name")).map((r) => `${r.code} (${r.name})`),
  };
  if (rules.department === 'organizations') out.Department = await names('organization_units');
  if (rules.department === 'projects') out.Project = await names('projects');
  if (rules.department === 'departmentOrProject') out.Department_or_Project = [...await names('organization_units'), ...await names('projects')];
  if (rules.designation) {
    out.Designation = (await rows(pool, "SELECT name, metadata FROM designations WHERE UPPER(status) = 'ACTIVE' ORDER BY name"))
      .filter((r) => { try { const m = JSON.parse(String(r.metadata || '{}')); return !m.empType || m.empType === type.code; } catch { return true; } })
      .map((r) => String(r.name));
  }
  if (rules.category) out.Cadre = [...CADRES];
  if (type.layout === 'permanent') out.Recruitment = [...RECRUITMENT_CATEGORIES];
  if (rules.course) {
    const msc = type.layout === 'bsc_msc_student';
    out[msc ? 'Stream' : 'Course'] = await names(msc ? 'msc_streams' : 'training_courses');
    out.Batch = await names(msc ? 'msc_batches' : 'trainee_batches');
  }
  if (rules.enrollment) out.Enrolled_Through = await names('phd_enrollments');
  return out;
}

export async function importTemplate(typeCode: unknown) {
  const type = await typeOf(typeCode);
  const columns = columnsFor(type.layout);
  return {
    type,
    headers: columns.map((c) => c.header),
    hints: columns.map((c, i) => `${i === 0 ? '# ' : ''}${c.required ? 'required' : 'optional'}: ${c.hint}`),
    values: await allowedValues(type),
    maxRows: MAX_EMPLOYEE_IMPORT_ROWS,
  };
}

// ---------------------------------------------------------------------------
// Review / import
// ---------------------------------------------------------------------------

export interface EmployeeImportRow {
  line: number;
  biometricId: string;
  name: string;
  status: 'ok' | 'error';
  error: string | null;
}
export interface EmployeeImportReview {
  type: { code: string; name: string };
  summary: { rows: number; ok: number; errors: number };
  rows: EmployeeImportRow[];
}

interface ParsedFile {
  type: ImportType;
  columns: ImportColumn[];
  rows: { line: number; cells: Record<string, string> }[];
}

function parseRequest(body: unknown): { typeCode: string; csv: string; sendWelcome: boolean } {
  const v = new Validator(body);
  const typeCode = v.string('employmentType', { max: 50 });
  const csv = v.string('csv', { min: 1, max: MAX_CSV_CHARS, trim: false });
  const sendWelcome = v.bool('sendWelcome', true);
  v.assert();
  return { typeCode, csv, sendWelcome };
}

async function parseFile(typeCode: string, csv: string): Promise<ParsedFile> {
  const type = await typeOf(typeCode);
  const columns = columnsFor(type.layout);
  const table = parseDelimited(csv).filter((r) => r.some((c) => c.trim()) && !String(r[0] ?? '').trim().startsWith('#'));
  if (!table.length) throw badRequest('The file is empty.', { csv: 'The file is empty.' });
  const header = table[0].map((h) => h.replace(/^﻿/, '').trim().toLowerCase());
  const missing = columns.filter((c) => !header.includes(c.header.toLowerCase())).map((c) => c.header);
  if (missing.length) {
    throw badRequest(`Missing column: ${missing.join(', ')}.`, { csv: `This is not the ${type.name} template. Missing column(s): ${missing.join(', ')}. Download the template for ${type.name}.` });
  }
  const body = table.slice(1);
  if (!body.length) throw badRequest('The file has no data rows.', { csv: 'The file has a header but no data rows.' });
  if (body.length > MAX_EMPLOYEE_IMPORT_ROWS) {
    throw badRequest(`At most ${MAX_EMPLOYEE_IMPORT_ROWS} rows at once.`, { csv: `The file has ${body.length} rows; at most ${MAX_EMPLOYEE_IMPORT_ROWS} can be imported at once. Split the file.` });
  }
  const position = new Map(columns.map((c) => [c.header, header.indexOf(c.header.toLowerCase())]));
  return {
    type, columns,
    rows: body.map((cells, i) => ({
      line: i + 2,
      cells: Object.fromEntries(columns.map((c) => [c.header, String(cells[position.get(c.header)!] ?? '').trim()])),
    })),
  };
}

const keyOf = (text: string) => text.trim().toLowerCase();

/** Lookups and shifts / leave groups, read once per file; a cell may give the code or the name. */
async function referenceMaps(q: Q) {
  const lookups = await rows(q, "SELECT lookup_type, code, name FROM lookup_values WHERE lookup_type IN ('salutation', 'gender', 'institute') AND UPPER(status) = 'ACTIVE'");
  const lookup = new Map<string, string>();
  for (const l of lookups) {
    lookup.set(`${l.lookup_type}:${keyOf(String(l.code))}`, String(l.code));
    lookup.set(`${l.lookup_type}:${keyOf(String(l.name))}`, String(l.code));
  }
  const shift = new Map<string, string>();
  for (const s of await rows(q, "SELECT id, name FROM shifts WHERE LOWER(status) = 'active'")) {
    shift.set(keyOf(String(s.name)), String(s.id));
    shift.set(String(s.id), String(s.id));
  }
  const group = new Map<string, string>();
  for (const g of await rows(q, "SELECT code, name FROM leave_groups WHERE status = 'active'")) {
    group.set(keyOf(String(g.code)), String(g.code));
    group.set(keyOf(String(g.name)), String(g.code));
    group.set(keyOf(`${g.code} (${g.name})`), String(g.code));
  }
  return { lookup, shift, group };
}

/** The form body for one row, or the problems of its cells (by column header). */
async function bodyOf(q: Q, file: ParsedFile, cells: Record<string, string>, maps: Awaited<ReturnType<typeof referenceMaps>>) {
  const body: Record<string, unknown> = { employmentType: file.type.code };
  const problems: string[] = [];
  for (const c of file.columns) {
    const text = cells[c.header] ?? '';
    if (!text) {
      if (c.required && !(c.header === 'Valid_Upto' && file.type.layout === 'permanent')) problems.push(`${c.header}: required`);
      if (c.kind === 'bool') body[c.key] = false;
      continue;
    }
    switch (c.kind) {
      case 'date': {
        const day = parseDay(text);
        if (!day) problems.push(`${c.header}: use DD-MM-YYYY`); else body[c.key] = day;
        break;
      }
      case 'bool': {
        const yes = parseYesNo(text);
        if (yes === null) problems.push(`${c.header}: Yes or No`); else body[c.key] = yes;
        break;
      }
      case 'lookup': {
        const code = maps.lookup.get(`${c.lookup}:${keyOf(text)}`);
        if (!code) problems.push(`${c.header}: "${text}" is not in Master Settings`); else body[c.key] = code;
        break;
      }
      case 'shift': {
        const id = maps.shift.get(keyOf(text));
        if (!id) problems.push(`Shift: "${text}" is not an active shift`); else body[c.key] = id;
        break;
      }
      case 'leaveGroup': {
        const code = maps.group.get(keyOf(text));
        if (!code) problems.push(`Leave_Group: "${text}" is not an active leave group`); else body[c.key] = code;
        break;
      }
      case 'choice': {
        const value = c.choices!.find((x) => keyOf(x) === keyOf(text));
        if (!value) problems.push(`${c.header}: one of ${c.choices!.join(', ')}`); else body[c.key] = value;
        break;
      }
      case 'person': {
        // Looked up inside the transaction, so a manager added on an earlier row of this file is found.
        const [person] = await rows(q, 'SELECT id FROM users WHERE biometric_id = ? LIMIT 1', [text]);
        if (!person) problems.push(`${c.header}: no employee with B.I. ${text}`); else body[c.key] = String(person.id);
        break;
      }
      default:
        body[c.key] = text;
    }
  }
  return { body, problems };
}

/** Field names of the form → the template's column headers, for messages. */
function fieldErrors(file: ParsedFile, details: Record<string, string> | undefined, fallback: string): string {
  if (!details || !Object.keys(details).length) return fallback;
  const header = new Map(file.columns.map((c) => [c.key, c.header]));
  header.set('suffix', 'Salutation');
  return Object.entries(details).map(([k, m]) => `${header.get(k) ?? k}: ${m}`).join('; ');
}

class Rollback extends Error {
  constructor(readonly review: EmployeeImportReview) { super('rollback'); }
}

/**
 * Creates every row in one transaction. `commit` false rolls it back (the review); true keeps it only when no row has a
 * problem. `hashes` gives each line its password hash.
 */
async function run(req: Request, file: ParsedFile, commit: boolean, hashes: (line: number) => string, note: string) {
  const created: { line: number; id: number }[] = [];
  const work = async (conn: PoolConnection): Promise<EmployeeImportReview> => {
    const maps = await referenceMaps(conn);
    const out = new Map<number, EmployeeImportRow>();
    const { order, cycle } = creationOrder(file.rows.map((r) => ({
      bi: r.cells.Biometric_ID,
      managers: [r.cells.Reporting_Manager_BI, r.cells.HoD_BI].filter(Boolean) as string[],
    })));
    for (const i of cycle) {
      const r = file.rows[i];
      out.set(r.line, { line: r.line, biometricId: r.cells.Biometric_ID, name: r.cells.Name, status: 'error', error: 'The reporting manager / HoD of these rows point at each other. Add one of them first.' });
    }
    for (const i of order) {
      const r = file.rows[i];
      const result: EmployeeImportRow = { line: r.line, biometricId: r.cells.Biometric_ID, name: r.cells.Name, status: 'ok', error: null };
      out.set(r.line, result);
      const selfManaged = [r.cells.Reporting_Manager_BI, r.cells.HoD_BI].includes(r.cells.Biometric_ID);
      const { body, problems } = await bodyOf(conn, file, r.cells, maps);
      if (selfManaged) problems.push('An employee who is their own reporting manager / HoD is added from "New employee", not by import');
      if (problems.length) { result.status = 'error'; result.error = problems.join('; '); continue; }
      await conn.query('SAVEPOINT import_row');
      try {
        const id = await insertEmployee(conn, req, body, hashes(r.line), note);
        created.push({ line: r.line, id });
        await conn.query('RELEASE SAVEPOINT import_row');
      } catch (error) {
        await conn.query('ROLLBACK TO SAVEPOINT import_row');
        if (error instanceof HttpError) {
          result.status = 'error';
          result.error = fieldErrors(file, error.details as Record<string, string> | undefined, error.message);
        } else if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
          result.status = 'error';
          result.error = 'An account with this email or biometric ID already exists.';
        } else throw error;
      }
    }
    const list = [...out.values()].sort((a, b) => a.line - b.line);
    const errors = list.filter((r) => r.status === 'error').length;
    const review = { type: { code: file.type.code, name: file.type.name }, summary: { rows: list.length, ok: list.length - errors, errors }, rows: list };
    if (!commit || errors) throw new Rollback(review);
    return review;
  };
  try {
    const review = await inTransaction(work);
    return { review, created };
  } catch (error) {
    if (error instanceof Rollback) return { review: error.review, created: [] };
    throw error;
  }
}

/** What the import would do, row by row. Nothing is kept. */
export async function reviewEmployeeImport(req: Request, body: unknown): Promise<EmployeeImportReview> {
  const input = parseRequest(body);
  const file = await parseFile(input.typeCode, input.csv);
  // Hashing is slow and the passwords are thrown away: any hash will do for the review.
  return (await run(req, file, false, () => '$2b$12$review.only.not.a.real.password.hash.......', 'review')).review;
}

export interface ImportedAccount { id: number; temporaryPassword: string | null }

/**
 * Creates all the accounts, or none when one row has a problem. With `sendWelcome` every account gets its own temporary
 * password (emailed by the caller); without it, the default password of Master Settings → Organization.
 */
export async function applyEmployeeImport(req: Request, body: unknown): Promise<{ review: EmployeeImportReview; accounts: ImportedAccount[]; sendWelcome: boolean }> {
  const input = parseRequest(body);
  const file = await parseFile(input.typeCode, input.csv);
  const passwords = new Map<number, { password: string | null; hash: string }>();
  if (input.sendWelcome) {
    // Made before the transaction (bcrypt is slow), a few at a time.
    const lines = file.rows;
    for (let i = 0; i < lines.length; i += 8) {
      await Promise.all(lines.slice(i, i + 8).map(async (r) => {
        let password = generateTemporaryPassword();
        const identity = { email: r.cells.Email, biometricId: r.cells.Biometric_ID };
        while (passwordProblem(password, identity)) password = generateTemporaryPassword();
        passwords.set(r.line, { password, hash: await bcrypt.hash(password, 12) });
      }));
    }
  } else {
    const hash = await defaultPasswordHash();
    if (!hash) throw new HttpError(409, 'Set the default password for new employees first (Master Settings → Organization), or send welcome emails.', 'DEFAULT_PASSWORD_MISSING');
    for (const r of file.rows) passwords.set(r.line, { password: null, hash });
  }
  const note = input.sendWelcome ? 'temporary (emailed; must be changed at first sign-in)' : 'default (must be changed at first sign-in)';
  const { review, created } = await run(req, file, true, (line) => passwords.get(line)!.hash, note);
  if (review.summary.errors) {
    throw new HttpError(400, `${review.summary.errors} row(s) have problems. Nothing was imported; fix the file and review again.`, 'IMPORT_INVALID', { csv: `${review.summary.errors} row(s) have problems.` });
  }
  return { review, sendWelcome: input.sendWelcome, accounts: created.map((c) => ({ id: c.id, temporaryPassword: passwords.get(c.line)?.password ?? null })) };
}
