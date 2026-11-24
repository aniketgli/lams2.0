import type { Request } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { readBlob, storeBlob } from '../lib/fileStore';
import { writeMasterAuditSql } from '../masters/audit';
import {
  CATEGORY_LABELS, type Category, type ProjectInput, STAGE_LABELS, type Stage, parseProjectInput, stageProblem,
} from './projectRules';

/**
 * PMS projects (the `projects` master, with the RC office's fields: migrations/20261228_pms_projects.sql).
 * Everyone working in PMS reads them; only the PMS Administrator (the RC office) creates, edits, imports, changes the
 * stage and uploads the documents (projects.routes.ts). Every change is in the activity log (master_audit_logs,
 * 'pms_projects' / 'funding_agencies').
 */

export const PROJECT_AUDIT_KEY = 'pms_projects';
export const AGENCY_AUDIT_KEY = 'funding_agencies';
type Q = Pick<PoolConnection, 'query'>;

async function rows(q: Q, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  try {
    const [found] = await q.query<RowDataPacket[]>(sql, params);
    return found;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') {
      throw new HttpError(503, 'The database needs an update. Ask the administrator to run migrations/20261228_pms_projects.sql.', 'NOT_CONFIGURED');
    }
    throw error;
  }
}

const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  return String(v).slice(0, 10);
};

export interface Person { id: string; name: string; biometricId: string; designation: string }
export interface ProjectFileInfo { name: string; size: number; uploadedAt: string }
export interface Project {
  id: string; code: string; title: string; shortName: string | null;
  category: Category | null; categoryLabel: string | null;
  fundingAgencyId: string | null; fundingAgency: string | null;
  scheme: string | null; sanctionOrderNo: string | null; sanctionDate: string | null; sanctionedAmount: number | null;
  startDate: string | null; endDate: string | null; durationMonths: number | null;
  pi: Person | null; piName: string | null; coPis: Person[];
  department: string | null; sites: string | null; objectives: string | null; remarks: string | null;
  stage: Stage; stageLabel: string; status: string; staff: number;
  files: { proposal: ProjectFileInfo | null; sanction: ProjectFileInfo | null };
  updatedAt: string | null;
}

/** Months from start to end, a started month counting (Apr 2024 – Mar 2027 = 36). */
export function durationMonths(start: string | null, end: string | null): number | null {
  if (!start || !end || end < start) return null;
  return (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7)) + 1;
}

const SELECT = `
  SELECT p.id, p.code, p.name, p.short_name, p.category, p.funding_agency_id, fa.name AS agency_name, p.scheme,
         p.sanction_order_no, p.sanction_date, p.sanctioned_amount, p.start_date, p.end_date, p.pi_user_id, p.pi_name,
         pu.name AS pi_user_name, pu.biometric_id AS pi_bio, pp.designation AS pi_designation,
         p.department, p.sites, p.objectives, p.remarks, p.stage, p.status, p.updated_at,
         (SELECT COUNT(*) FROM employee_profiles ep WHERE ep.project_name = p.name) AS staff
    FROM projects p
    LEFT JOIN funding_agencies fa ON fa.id = p.funding_agency_id
    LEFT JOIN users pu ON pu.id = p.pi_user_id
    LEFT JOIN employee_profiles pp ON pp.biometric_id = pu.biometric_id`;

async function decorate(q: Q, found: RowDataPacket[]): Promise<Project[]> {
  if (!found.length) return [];
  const ids = found.map((r) => Number(r.id));
  const coRows = await rows(q,
    `SELECT c.project_id, u.id, u.name, u.biometric_id, ep.designation FROM project_co_pis c JOIN users u ON u.id = c.user_id
       LEFT JOIN employee_profiles ep ON ep.biometric_id = u.biometric_id WHERE c.project_id IN (?) ORDER BY u.name`, [ids]);
  const fileRows = await rows(q, 'SELECT project_id, kind, file_name, size_bytes, uploaded_at FROM project_files WHERE project_id IN (?)', [ids]);
  return found.map((r) => {
    const start = iso(r.start_date), end = iso(r.end_date);
    const file = (kind: string): ProjectFileInfo | null => {
      const f = fileRows.find((x) => Number(x.project_id) === Number(r.id) && x.kind === kind);
      return f ? { name: String(f.file_name), size: Number(f.size_bytes), uploadedAt: new Date(f.uploaded_at).toISOString() } : null;
    };
    const stage = (String(r.stage ?? 'ongoing') as Stage);
    const category = r.category ? (String(r.category) as Category) : null;
    return {
      id: String(r.id), code: String(r.code), title: String(r.name), shortName: r.short_name ?? null,
      category, categoryLabel: category ? CATEGORY_LABELS[category] ?? category : null,
      fundingAgencyId: r.funding_agency_id ? String(r.funding_agency_id) : null, fundingAgency: r.agency_name ?? null,
      scheme: r.scheme ?? null, sanctionOrderNo: r.sanction_order_no ?? null, sanctionDate: iso(r.sanction_date),
      sanctionedAmount: r.sanctioned_amount === null || r.sanctioned_amount === undefined ? null : Number(r.sanctioned_amount),
      startDate: start, endDate: end, durationMonths: durationMonths(start, end),
      pi: r.pi_user_id ? { id: String(r.pi_user_id), name: String(r.pi_user_name ?? ''), biometricId: String(r.pi_bio ?? ''), designation: String(r.pi_designation ?? '') } : null,
      piName: r.pi_user_name ?? r.pi_name ?? null,
      coPis: coRows.filter((c) => Number(c.project_id) === Number(r.id)).map((c) => ({ id: String(c.id), name: String(c.name), biometricId: String(c.biometric_id), designation: String(c.designation ?? '') })),
      department: r.department ?? null, sites: r.sites ?? null, objectives: r.objectives ?? null, remarks: r.remarks ?? null,
      stage, stageLabel: STAGE_LABELS[stage] ?? stage, status: String(r.status ?? 'ACTIVE').toUpperCase(), staff: Number(r.staff ?? 0),
      files: { proposal: file('proposal'), sanction: file('sanction') },
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    };
  });
}

export async function listProjects(): Promise<Project[]> {
  return decorate(pool, await rows(pool, `${SELECT} ORDER BY p.updated_at DESC, p.id DESC`));
}

export async function getProject(q: Q, id: number): Promise<Project> {
  const [found] = await decorate(q, await rows(q, `${SELECT} WHERE p.id = ? LIMIT 1`, [id]));
  if (!found) throw notFound('Project not found.');
  return found;
}

/** The audit snapshot of a project (names, not ids). */
const snapshot = (p: Project) => ({
  code: p.code, title: p.title, shortName: p.shortName, category: p.categoryLabel, fundingAgency: p.fundingAgency, scheme: p.scheme,
  sanctionOrderNo: p.sanctionOrderNo, sanctionDate: p.sanctionDate, sanctionedAmount: p.sanctionedAmount, startDate: p.startDate, endDate: p.endDate,
  pi: p.pi ? `${p.pi.name} (${p.pi.biometricId})` : p.piName, coPis: p.coPis.map((c) => `${c.name} (${c.biometricId})`).join(', ') || null,
  department: p.department, sites: p.sites, objectives: p.objectives, remarks: p.remarks, stage: p.stageLabel,
});

/** Checks the references (agency, PI, Co-PIs) and the uniqueness of code and title; field errors otherwise. */
async function checkReferences(q: Q, input: ProjectInput, selfId: number | null): Promise<{ piName: string | null }> {
  const errors: Record<string, string> = {};
  if (input.fundingAgencyId) {
    const [a] = await rows(q, 'SELECT status FROM funding_agencies WHERE id = ? LIMIT 1', [input.fundingAgencyId]);
    if (!a) errors.fundingAgencyId = 'Choose a funding agency from the list.';
  }
  const people = [...(input.piUserId ? [input.piUserId] : []), ...input.coPiUserIds];
  const found = people.length
    ? await rows(q, "SELECT id, name FROM users WHERE id IN (?) AND is_system = 0 AND LOWER(status) = 'active'", [people])
    : [];
  const nameOf = new Map(found.map((u) => [Number(u.id), String(u.name)]));
  if (input.piUserId && !nameOf.has(input.piUserId)) errors.piUserId = 'Choose an active employee as the PI.';
  if (input.coPiUserIds.some((u) => !nameOf.has(u))) errors.coPiUserIds = 'Choose active employees as Co-PIs.';
  const [dupCode] = await rows(q, 'SELECT id FROM projects WHERE LOWER(code) = LOWER(?) AND id <> ? LIMIT 1', [input.code, selfId ?? 0]);
  if (dupCode) errors.code = 'Another project already has this code.';
  const [dupTitle] = await rows(q, 'SELECT id FROM projects WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1', [input.title, selfId ?? 0]);
  if (dupTitle) errors.title = 'Another project already has this title.';
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
  return { piName: input.piUserId ? nameOf.get(input.piUserId) ?? null : null };
}

const COLUMNS = (input: ProjectInput, piName: string | null, actor: string) => [
  input.title, input.code, piName, input.shortName, input.category, input.fundingAgencyId, input.scheme, input.sanctionOrderNo,
  input.sanctionDate, input.sanctionedAmount, input.startDate, input.endDate, input.piUserId, input.department, input.sites,
  input.objectives, input.remarks, actor,
];

async function saveCoPis(q: Q, projectId: number, ids: number[]): Promise<void> {
  await q.query('DELETE FROM project_co_pis WHERE project_id = ?', [projectId]);
  for (const userId of ids) await q.query('INSERT INTO project_co_pis (project_id, user_id) VALUES (?, ?)', [projectId, userId]);
}

/** Inserts one project inside the caller's transaction (the form and the bulk import). */
export async function insertProject(conn: Q, req: Request, input: ProjectInput, reason: string | null = null): Promise<Project> {
  const { piName } = await checkReferences(conn, input, null);
  const actor = String(req.auth?.account.biometricId ?? '');
  const [result] = await conn.query<import('mysql2').ResultSetHeader>(
    `INSERT INTO projects (name, code, pi_name, short_name, category, funding_agency_id, scheme, sanction_order_no, sanction_date,
       sanctioned_amount, start_date, end_date, pi_user_id, department, sites, objectives, remarks, created_by, updated_by, stage, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [...COLUMNS(input, piName, actor), actor, input.stage]);
  const id = Number(result.insertId);
  await saveCoPis(conn, id, input.coPiUserIds);
  const project = await getProject(conn, id);
  await writeMasterAuditSql(conn, req, {
    masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: `${project.code} · ${project.title}`, action: 'CREATE',
    after: snapshot(project), reason,
  });
  return project;
}

export async function createProject(req: Request, body: unknown): Promise<Project> {
  const input = parseProjectInput(body);
  return inTransaction((conn) => insertProject(conn, req, input));
}

export async function updateProject(req: Request, id: number, body: unknown): Promise<Project> {
  const input = parseProjectInput(body);
  return inTransaction(async (conn) => {
    await rows(conn, 'SELECT id FROM projects WHERE id = ? FOR UPDATE', [id]);
    const before = await getProject(conn, id);
    // Employee profiles and career histories point to a project by its title: then title and code stay as they are.
    if ((before.title !== input.title || before.code.toLowerCase() !== input.code.toLowerCase()) && before.staff > 0) {
      throw badRequest('Please correct the highlighted fields.', {
        [before.title !== input.title ? 'title' : 'code']: `${before.staff} employee profile(s) name this project, so its title and code cannot be changed.`,
      });
    }
    const [history] = before.title !== input.title ? await rows(conn, 'SELECT COUNT(*) AS n FROM user_histories WHERE project_name = ?', [before.title]) : [{ n: 0 }];
    if (Number(history?.n ?? 0) > 0) throw badRequest('Please correct the highlighted fields.', { title: 'Career histories name this project, so its title cannot be changed.' });
    const { piName } = await checkReferences(conn, input, id);
    const actor = String(req.auth?.account.biometricId ?? '');
    // The stage is changed on its own (changeStage), with its rules; the form keeps it.
    await conn.query(
      `UPDATE projects SET name = ?, code = ?, pi_name = ?, short_name = ?, category = ?, funding_agency_id = ?, scheme = ?, sanction_order_no = ?,
         sanction_date = ?, sanctioned_amount = ?, start_date = ?, end_date = ?, pi_user_id = ?, department = ?, sites = ?, objectives = ?,
         remarks = ?, updated_by = ? WHERE id = ?`,
      [...COLUMNS(input, piName, actor), id]);
    await saveCoPis(conn, id, input.coPiUserIds);
    const after = await getProject(conn, id);
    await writeMasterAuditSql(conn, req, {
      masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: `${after.code} · ${after.title}`, action: 'UPDATE',
      before: snapshot(before), after: snapshot(after),
    });
    return after;
  });
}

export async function changeStage(req: Request, id: number, body: unknown): Promise<Project> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const to = String(raw.stage ?? '') as Stage;
  if (!(to in STAGE_LABELS)) throw badRequest('Please correct the highlighted fields.', { stage: 'Choose the new stage.' });
  const reason = typeof raw.reason === 'string' && raw.reason.trim() ? raw.reason.trim().slice(0, 500) : null;
  const newEndDate = typeof raw.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.endDate) ? raw.endDate : null;
  return inTransaction(async (conn) => {
    await rows(conn, 'SELECT id FROM projects WHERE id = ? FOR UPDATE', [id]);
    const before = await getProject(conn, id);
    const problem = stageProblem(before.stage, to, { reason, endDate: before.endDate, newEndDate });
    if (problem) throw badRequest(problem, { [problem.includes('end date') ? 'endDate' : problem === 'Give the reason.' ? 'reason' : 'stage']: problem });
    const actor = String(req.auth?.account.biometricId ?? '');
    await conn.query(`UPDATE projects SET stage = ?, ${to === 'extended' ? 'end_date = ?, ' : ''}updated_by = ? WHERE id = ?`,
      to === 'extended' ? [to, newEndDate, actor, id] : [to, actor, id]);
    const after = await getProject(conn, id);
    await writeMasterAuditSql(conn, req, {
      masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: `${after.code} · ${after.title}`, action: 'STATUS',
      before: { stage: before.stageLabel, endDate: before.endDate }, after: { stage: after.stageLabel, endDate: after.endDate }, reason,
    });
    return after;
  });
}

// ---------------------------------------------------------------------------
// Documents: the proposal and the sanction order (PDF, up to 8 MB)
// ---------------------------------------------------------------------------

export const PROJECT_FILE_KINDS = ['proposal', 'sanction'] as const;
export type ProjectFileKind = (typeof PROJECT_FILE_KINDS)[number];
export const PROJECT_FILE_MAX_BYTES = 8 * 1024 * 1024;
const FILE_LABEL: Record<ProjectFileKind, string> = { proposal: 'proposal', sanction: 'sanction order' };

export async function saveProjectFile(req: Request, id: number, kind: ProjectFileKind, body: unknown): Promise<Project> {
  const { name, data } = (body ?? {}) as { name?: unknown; data?: unknown };
  const fail = (message: string) => badRequest('Please correct the highlighted fields.', { file: message });
  const match = typeof data === 'string' ? /^data:[a-z0-9+./-]*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(data) : null;
  if (!match) throw fail('The file could not be read.');
  const bytes = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  if (!bytes.length) throw fail('The file is empty.');
  if (bytes.length > PROJECT_FILE_MAX_BYTES) throw fail('Use a PDF smaller than 8 MB.');
  if (bytes.toString('ascii', 0, 5) !== '%PDF-') throw fail(`The ${FILE_LABEL[kind]} must be a PDF file.`);
  const cleaned = (typeof name === 'string' ? name : '').replace(/[\\/\r\n"]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120).replace(/\.pdf$/i, '');
  const fileName = `${cleaned || `${kind}`}.pdf`;
  return inTransaction(async (conn) => {
    const before = await getProject(conn, id);
    const stored = await storeBlob('projects', `project-${id}-${kind}`, 'pdf', bytes);
    await conn.query(
      `INSERT INTO project_files (project_id, kind, file_name, mime_type, size_bytes, data, storage_path, uploaded_by) VALUES (?, ?, ?, 'application/pdf', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), size_bytes = VALUES(size_bytes), data = VALUES(data), storage_path = VALUES(storage_path),
         uploaded_by = VALUES(uploaded_by), uploaded_at = CURRENT_TIMESTAMP(3)`,
      [id, kind, fileName, bytes.length, stored.data, stored.storagePath, String(req.auth?.account.biometricId ?? '')]);
    await writeMasterAuditSql(conn, req, {
      masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: `${before.code} · ${before.title}`, action: before.files[kind] ? 'UPDATE' : 'CREATE',
      before: before.files[kind] ? { [FILE_LABEL[kind]]: before.files[kind]!.name } : undefined, after: { [FILE_LABEL[kind]]: fileName },
      reason: `${FILE_LABEL[kind]} uploaded`,
    });
    return getProject(conn, id);
  });
}

export async function loadProjectFile(id: number, kind: ProjectFileKind): Promise<{ name: string; data: Buffer }> {
  const [row] = await rows(pool, 'SELECT file_name, data, storage_path FROM project_files WHERE project_id = ? AND kind = ? LIMIT 1', [id, kind]);
  if (!row) throw notFound(`No ${FILE_LABEL[kind]} is attached to this project.`);
  const data = await readBlob(row);
  if (!data || data.toString('ascii', 0, 5) !== '%PDF-') throw notFound(`The ${FILE_LABEL[kind]} file could not be found.`);
  return { name: String(row.file_name), data };
}

// ---------------------------------------------------------------------------
// Funding agencies
// ---------------------------------------------------------------------------

export interface Agency { id: string; name: string; code: string; status: 'ACTIVE' | 'INACTIVE'; projects: number }

export async function listAgencies(q: Q = pool): Promise<Agency[]> {
  const found = await rows(q,
    'SELECT a.id, a.name, a.code, a.status, (SELECT COUNT(*) FROM projects p WHERE p.funding_agency_id = a.id) AS projects FROM funding_agencies a ORDER BY a.name');
  return found.map((r) => ({ id: String(r.id), name: String(r.name), code: String(r.code), status: String(r.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', projects: Number(r.projects) }));
}

function parseAgency(body: unknown): { name: string; code: string; status: 'ACTIVE' | 'INACTIVE' } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const code = typeof b.code === 'string' ? b.code.trim().toUpperCase() : '';
  if (!name) errors.name = 'This field is required.'; else if (name.length > 200) errors.name = 'Must be at most 200 characters.';
  if (!code) errors.code = 'This field is required.'; else if (!/^[A-Z0-9][A-Z0-9&\-_.]{0,39}$/.test(code)) errors.code = 'Use up to 40 letters, digits and & - _ .';
  const status = b.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
  return { name, code, status };
}

export async function saveAgency(req: Request, id: number | null, body: unknown): Promise<Agency> {
  const input = parseAgency(body);
  return inTransaction(async (conn) => {
    const errors: Record<string, string> = {};
    const [dupName] = await rows(conn, 'SELECT id FROM funding_agencies WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1', [input.name, id ?? 0]);
    if (dupName) errors.name = 'Another funding agency already has this name.';
    const [dupCode] = await rows(conn, 'SELECT id FROM funding_agencies WHERE code = ? AND id <> ? LIMIT 1', [input.code, id ?? 0]);
    if (dupCode) errors.code = 'Another funding agency already has this code.';
    if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
    let before: RowDataPacket | undefined;
    if (id) {
      [before] = await rows(conn, 'SELECT name, code, status FROM funding_agencies WHERE id = ? FOR UPDATE', [id]);
      if (!before) throw notFound('Funding agency not found.');
      await conn.query('UPDATE funding_agencies SET name = ?, code = ?, status = ? WHERE id = ?', [input.name, input.code, input.status, id]);
    } else {
      const [r] = await conn.query<import('mysql2').ResultSetHeader>('INSERT INTO funding_agencies (name, code, status) VALUES (?, ?, ?)', [input.name, input.code, input.status]);
      id = Number(r.insertId);
    }
    await writeMasterAuditSql(conn, req, {
      masterKey: AGENCY_AUDIT_KEY, recordId: id, recordLabel: `${input.name} (${input.code})`, action: before ? 'UPDATE' : 'CREATE',
      before: before ? { name: before.name, code: before.code, status: before.status } : undefined, after: input,
    });
    const [saved] = (await listAgencies(conn)).filter((a) => a.id === String(id));
    return saved ?? { id: String(id), ...input, projects: 0 };
  });
}
