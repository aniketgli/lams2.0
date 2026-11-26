import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { parseDelimited } from '../leave/balanceImport';
import { parseDay } from '../employees/bulkImportRules';
import { IMPORT_COLUMNS, MAX_PROJECT_IMPORT_ROWS, type ProjectInput, categoryFromText, parseProjectInput, stageFromText } from './projectRules';
import { PI_ROLE_MESSAGE, insertProject, listPiOptions } from './store';

/**
 * Bulk import of projects (RC office): a CSV with the template's columns (projectRules.ts IMPORT_COLUMNS).
 * Review checks every row and writes nothing; import writes all rows in one transaction, or none when a row has a
 * problem (the same as the employee import). Codes and titles must be new: existing projects are edited one by one.
 */

export interface ProjectImportRow { line: number; code: string; title: string; status: 'ok' | 'error'; error: string | null }
export interface ProjectImportReview { summary: { rows: number; ok: number; errors: number }; rows: ProjectImportRow[] }

const MAX_CSV_CHARS = 3_000_000;

function csvOf(body: unknown): string {
  const csv = (body as { csv?: unknown } | null)?.csv;
  if (typeof csv !== 'string' || !csv.trim()) throw badRequest('Choose the CSV file.', { csv: 'Choose the CSV file.' });
  if (csv.length > MAX_CSV_CHARS) throw badRequest('The file is too large.', { csv: 'The file is too large (at most 3 MB).' });
  return csv;
}

interface Parsed { line: number; input: ProjectInput | null; code: string; title: string; error: string | null }

async function parse(csv: string): Promise<Parsed[]> {
  const table = parseDelimited(csv).filter((r) => r.some((c) => c.trim()) && !String(r[0] ?? '').trim().startsWith('#'));
  if (!table.length) throw badRequest('The file is empty.', { csv: 'The file is empty.' });
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (h: string) => header.indexOf(h.toLowerCase());
  const missing = IMPORT_COLUMNS.filter((c) => c.required && col(c.header) < 0).map((c) => c.header);
  if (missing.length) throw badRequest(`Missing column: ${missing.join(', ')}.`, { csv: `This is not the project template. Missing column(s): ${missing.join(', ')}. Download the template.` });
  const body = table.slice(1);
  if (!body.length) throw badRequest('The file has no data rows.', { csv: 'The file has a header but no data rows.' });
  if (body.length > MAX_PROJECT_IMPORT_ROWS) throw badRequest(`At most ${MAX_PROJECT_IMPORT_ROWS} rows at once.`, { csv: `The file has ${body.length} rows; at most ${MAX_PROJECT_IMPORT_ROWS} can be imported at once. Split the file.` });

  const agencies = await pool.query<RowDataPacket[]>("SELECT id, name, code FROM funding_agencies WHERE UPPER(status) = 'ACTIVE'").then(([r]) => r);
  const people = await pool.query<RowDataPacket[]>("SELECT id, biometric_id FROM users WHERE is_system = 0 AND LOWER(status) = 'active'").then(([r]) => r);
  const agencyOf = (t: string) => {
    const k = t.trim().toLowerCase();
    return agencies.find((a) => String(a.name).toLowerCase() === k || String(a.code).toLowerCase() === k);
  };
  const userOf = (bio: string) => people.find((p) => String(p.biometric_id).toUpperCase() === bio.trim().toUpperCase());
  // The PI is one of the PMS PIs, by biometric ID or by name (exactly one with that name).
  const piOptions = await listPiOptions();
  const nameKey = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

  const out: Parsed[] = [];
  const seenCode = new Set<string>(), seenTitle = new Set<string>();
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (h: string) => { const c = col(h); return c >= 0 ? String(cells[c] ?? '').trim() : ''; };
    const code = get('Project_Code'), title = get('Title');
    const problems: string[] = [];
    const date = (h: string) => {
      const t = get(h);
      if (!t) return null;
      const d = parseDay(t);
      if (!d) problems.push(`${h}: use DD-MM-YYYY.`);
      return d;
    };
    const category = categoryFromText(get('Category'));
    if (category === undefined) problems.push('Category: use Externally funded, Grant-in-aid, Consultancy or In-house.');
    const stage = stageFromText(get('Stage'));
    if (stage === undefined) problems.push('Stage: not recognised.');
    const agencyText = get('Funding_Agency');
    const agency = agencyText ? agencyOf(agencyText) : null;
    if (agencyText && !agency) problems.push(`Funding_Agency: "${agencyText}" is not in Funding Agencies.`);
    const piBio = get('PI_Biometric_ID'), piText = get('PI_Name');
    let pi: { id: string } | null = null;
    if (piBio) {
      pi = piOptions.find((o) => o.biometricId.toUpperCase() === piBio.toUpperCase()) ?? null;
      if (!pi) problems.push(userOf(piBio) ? `PI_Biometric_ID: ${piBio} does not have the PMS PI role.` : `PI_Biometric_ID: no active employee ${piBio}.`);
    } else if (piText) {
      const matches = piOptions.filter((o) => nameKey(o.name) === nameKey(piText));
      if (matches.length === 1) pi = matches[0];
      else problems.push(matches.length ? `PI_Name: more than one PMS PI is named "${piText}"; use PI_Biometric_ID.` : `PI_Name: "${piText}" — ${PI_ROLE_MESSAGE}`);
    }
    const coBios = get('CoPI_Biometric_IDs').split(/[;|]/).map((s) => s.trim()).filter(Boolean);
    const co = coBios.map((b) => ({ b, u: userOf(b) }));
    for (const c of co) if (!c.u) problems.push(`CoPI_Biometric_IDs: no active employee ${c.b}.`);
    const fields = {
      code, title, shortName: get('Short_Name'), category: category ?? '', fundingAgencyId: agency ? String(agency.id) : '',
      scheme: get('Scheme'), sanctionOrderNo: get('Sanction_Order_No'), sanctionDate: date('Sanction_Date') ?? '',
      sanctionedAmount: get('Sanctioned_Amount'), startDate: date('Start_Date') ?? '', endDate: date('End_Date') ?? '',
      piUserId: pi ? String(pi.id) : '', piName: '', coPiUserIds: co.filter((c) => c.u).map((c) => String(c.u!.id)),
      department: get('Department'), sites: get('Sites'), objectives: get('Objectives'), remarks: get('Remarks'), stage: stage ?? '',
    };
    let input: ProjectInput | null = null;
    try {
      input = parseProjectInput(fields);
    } catch (error) {
      const details = (error as HttpError).details as Record<string, string> | undefined;
      if (details) problems.push(...Object.entries(details).map(([k, m]) => `${IMPORT_COLUMNS.find((c) => c.key === k)?.header ?? k}: ${m}`));
      else throw error;
    }
    const codeKey = code.toLowerCase(), titleKey = title.toLowerCase();
    if (code && seenCode.has(codeKey)) problems.push('Project_Code: twice in this file.');
    if (title && seenTitle.has(titleKey)) problems.push('Title: twice in this file.');
    if (code) seenCode.add(codeKey);
    if (title) seenTitle.add(titleKey);
    out.push({ line, input: problems.length ? null : input, code, title, error: problems.length ? problems.join(' ') : null });
  });
  return out;
}

async function existing(): Promise<{ codes: Set<string>; titles: Set<string> }> {
  const [found] = await pool.query<RowDataPacket[]>('SELECT code, name FROM projects');
  return { codes: new Set(found.map((r) => String(r.code).toLowerCase())), titles: new Set(found.map((r) => String(r.name).toLowerCase())) };
}

function review(parsed: Parsed[], have: { codes: Set<string>; titles: Set<string> }): ProjectImportReview {
  const rows: ProjectImportRow[] = parsed.map((p) => {
    const problems = p.error ? [p.error] : [];
    if (p.code && have.codes.has(p.code.toLowerCase())) problems.push('Project_Code: a project with this code already exists.');
    if (have.titles.has(p.title.toLowerCase())) problems.push('Title: a project with this title already exists.');
    return { line: p.line, code: p.code || '(automatic)', title: p.title, status: problems.length ? 'error' : 'ok', error: problems.length ? problems.join(' ') : null };
  });
  const ok = rows.filter((r) => r.status === 'ok').length;
  return { summary: { rows: rows.length, ok, errors: rows.length - ok }, rows };
}

export async function reviewProjectImport(body: unknown): Promise<ProjectImportReview> {
  return review(await parse(csvOf(body)), await existing());
}

export async function applyProjectImport(req: Request, body: unknown): Promise<ProjectImportReview> {
  const parsed = await parse(csvOf(body));
  const result = review(parsed, await existing());
  if (result.summary.errors) {
    throw new HttpError(400, `${result.summary.errors} row(s) have problems. Nothing was imported; fix the file and review again.`, 'IMPORT_INVALID', { csv: `${result.summary.errors} row(s) have problems.` });
  }
  await inTransaction(async (conn) => {
    for (const p of parsed) await insertProject(conn, req, p.input!, `Bulk import, line ${p.line}`);
  });
  return result;
}
