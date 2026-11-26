import type { Request } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { badRequest, notFound } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { Validator, todayInIndia } from '../lib/validate';
import { readBlob, storeBlob } from '../lib/fileStore';
import { writeMasterAuditSql } from '../masters/audit';
import { employeeTypeModules } from '../employees/references';
import { LAYOUT_RULES, isFormLayout } from '../employees/fields';
import { managerRoleHolders } from '../employees/managerRoles';
import { transferEmployees, type OrderResult } from '../employees/mapping';
import { PROJECT_AUDIT_KEY, PROJECT_FILE_MAX_BYTES, type Project, projectFor } from './store';

/**
 * The project workspace (PMS → Projects → a project): its employees, funds, activities and documents.
 * The RC office (PMS Administrator) works on every project, a PI on the projects where they are the PI, the PMS
 * Auditor reads (projectFor). Every change is written to the project's audit log.
 *
 * Employees belong to a project through their profile (department = the project). Adding employees to a project and
 * changing their reporting manager are Employee Mapping orders (mapping.ts: register + audit), with the PMS roles:
 * the reporting manager must hold the PMS Reporting Manager role. Leave / attendance approvals stay with that RM.
 */

type Q = Pick<PoolConnection, 'query'>;

async function rows(q: Q, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await q.query<RowDataPacket[]>(sql, params);
  return result;
}

const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  return String(v).slice(0, 10);
};
const money = (v: unknown): number => Math.round(Number(v ?? 0) * 100) / 100;
const actorOf = (req: Request) => String(req.auth?.account.biometricId ?? '');
const label = (p: Project) => `${p.code} · ${p.title}`;

/** An amount in rupees from the form (commas allowed): more than zero unless `zero` is allowed. */
function amount(v: Validator, field: string, zero = false): number {
  const raw = v.raw(field);
  const n = Number(String(raw ?? '').replace(/,/g, ''));
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(n) || n < 0 || (!zero && n === 0) || n > 9_999_999_999_999) {
    v.errors[field] ||= zero ? 'Enter the amount in rupees (0 or more).' : 'Enter the amount in rupees (more than 0).';
    return 0;
  }
  return Math.round(n * 100) / 100;
}

const idParam = (raw: unknown, what = 'entry'): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${what}.`);
  return n;
};

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export interface ProjectEmployee {
  id: string; biometricId: string; name: string; status: string; designation: string | null; employmentType: string | null;
  reportingManager: { id: string; name: string; biometricId: string } | null;
}
export interface PickPerson { id: string; name: string; biometricId: string; designation: string | null; department: string | null }

export async function projectEmployees(req: Request, id: number): Promise<{ employees: ProjectEmployee[]; candidates: PickPerson[]; managers: PickPerson[] }> {
  const project = await projectFor(pool, req, id, false);
  const found = await rows(pool,
    `SELECT u.id, u.biometric_id, u.name, u.status, p.designation, et.name AS type_name,
            rm.id AS rm_id, rm.name AS rm_name, rm.biometric_id AS rm_bio
       FROM employee_profiles p JOIN users u ON u.biometric_id = p.biometric_id
       LEFT JOIN employee_types et ON et.code = p.employment_type
       LEFT JOIN users rm ON rm.id = p.reporting_manager_id
      WHERE p.project_name = ? AND u.is_system = 0 ORDER BY u.name`, [project.title]);
  const employees = found.map((r) => ({
    id: String(r.id), biometricId: String(r.biometric_id), name: String(r.name), status: String(r.status), designation: r.designation ?? null,
    employmentType: r.type_name ?? null,
    reportingManager: r.rm_id ? { id: String(r.rm_id), name: String(r.rm_name), biometricId: String(r.rm_bio) } : null,
  }));
  // Who can be added: active PMS employees whose type has a project on its form, not yet on this project.
  // Managers: the PMS Reporting Managers.
  const pmsTypes = [...await projectTypes()];
  const candidates = pmsTypes.length ? (await rows(pool,
    `SELECT u.id, u.biometric_id, u.name, p.designation, p.department FROM employee_profiles p JOIN users u ON u.biometric_id = p.biometric_id
      WHERE u.is_system = 0 AND LOWER(u.status) = 'active' AND p.employment_type IN (?) AND NOT (p.project_name <=> ?) ORDER BY u.name`,
    [pmsTypes, project.title])).map(pick) : [];
  const holders = [...await managerRoleHolders(pool, 'reporting', 'PMS')];
  const managers = holders.length ? (await rows(pool,
    `SELECT u.id, u.biometric_id, u.name, p.designation, p.department FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
      WHERE u.biometric_id IN (?) AND u.is_system = 0 AND LOWER(u.status) = 'active' ORDER BY u.name`, [holders])).map(pick) : [];
  return { employees, candidates, managers };
}

const pick = (r: RowDataPacket): PickPerson => ({
  id: String(r.id), name: String(r.name), biometricId: String(r.biometric_id), designation: r.designation ?? null, department: r.department ?? null,
});

/**
 * The PMS employee types whose form has a project (Project staff, interns …): only their employees can be put on
 * a project. A type whose form asks for a department (e.g. Contractual) keeps a department instead.
 */
async function projectTypes(): Promise<Set<string>> {
  const modules = await employeeTypeModules(pool);
  const layouts = await rows(pool, "SELECT code, form_layout FROM employee_types WHERE UPPER(status) = 'ACTIVE'");
  return new Set(layouts.filter((t) => {
    const layout = String(t.form_layout);
    const department = isFormLayout(layout) ? LAYOUT_RULES[layout].department : undefined;
    return modules.get(String(t.code)) === 'PMS' && (department === 'projects' || department === 'departmentOrProject');
  }).map((t) => String(t.code)));
}

/** Puts PMS employees on the project (their department becomes the project), optionally with a reporting manager. */
export async function addProjectEmployees(req: Request, id: number, body: unknown): Promise<OrderResult> {
  const project = await projectFor(pool, req, id, true);
  const b = (body ?? {}) as Record<string, unknown>;
  const allowed = await projectTypes();
  return transferEmployees(req, {
    userIds: b.userIds, department: project.title, reportingManagerId: b.reportingManagerId || undefined,
    effectiveDate: b.effectiveDate || todayInIndia(), notes: b.notes || `Added to project ${project.code}`,
  }, {
    module: 'PMS',
    check: async (t) => (allowed.has(t.employmentType ?? '') ? null : 'only PMS employees whose form has a project (Project staff, interns …) can be put on a project.'),
  });
}

/** Gives employees of the project another reporting manager (a PMS Reporting Manager). */
export async function changeProjectManager(req: Request, id: number, body: unknown): Promise<OrderResult> {
  const project = await projectFor(pool, req, id, true);
  const b = (body ?? {}) as Record<string, unknown>;
  if (!b.reportingManagerId) throw badRequest('Please correct the highlighted fields.', { reportingManagerId: 'Choose the reporting manager.' });
  return transferEmployees(req, {
    userIds: b.userIds, reportingManagerId: b.reportingManagerId, effectiveDate: b.effectiveDate || todayInIndia(),
    notes: b.notes || `Reporting manager changed in project ${project.code}`,
  }, {
    module: 'PMS',
    check: async (t) => (t.department === project.title ? null : 'is not on this project.'),
  });
}

// ---------------------------------------------------------------------------
// Funds: budget heads, instalments received, expenditure
// ---------------------------------------------------------------------------

export interface BudgetHead { id: string; name: string; sanctioned: number; spent: number; remarks: string | null }
export interface Receipt { id: string; receivedOn: string; amount: number; reference: string | null; remarks: string | null }
export interface Expenditure { id: string; spentOn: string; amount: number; headId: string | null; head: string | null; description: string; voucherNo: string | null }
export interface Funds {
  heads: BudgetHead[]; receipts: Receipt[]; expenditures: Expenditure[];
  totals: { sanctioned: number; budgeted: number; received: number; spent: number; balance: number };
}

export async function projectFunds(req: Request, id: number): Promise<Funds> {
  const project = await projectFor(pool, req, id, false);
  return fundsOf(pool, project);
}

async function fundsOf(q: Q, project: Project): Promise<Funds> {
  const pid = Number(project.id);
  const headRows = await rows(q,
    `SELECT h.id, h.name, h.sanctioned_amount, h.remarks, (SELECT COALESCE(SUM(e.amount), 0) FROM project_expenditures e WHERE e.head_id = h.id) AS spent
       FROM project_budget_heads h WHERE h.project_id = ? ORDER BY h.name`, [pid]);
  const receiptRows = await rows(q, 'SELECT id, received_on, amount, reference, remarks FROM project_fund_receipts WHERE project_id = ? ORDER BY received_on DESC, id DESC', [pid]);
  const spentRows = await rows(q,
    `SELECT e.id, e.spent_on, e.amount, e.head_id, h.name AS head, e.description, e.voucher_no FROM project_expenditures e
       LEFT JOIN project_budget_heads h ON h.id = e.head_id WHERE e.project_id = ? ORDER BY e.spent_on DESC, e.id DESC`, [pid]);
  const heads = headRows.map((r) => ({ id: String(r.id), name: String(r.name), sanctioned: money(r.sanctioned_amount), spent: money(r.spent), remarks: r.remarks ?? null }));
  const receipts = receiptRows.map((r) => ({ id: String(r.id), receivedOn: iso(r.received_on)!, amount: money(r.amount), reference: r.reference ?? null, remarks: r.remarks ?? null }));
  const expenditures = spentRows.map((r) => ({
    id: String(r.id), spentOn: iso(r.spent_on)!, amount: money(r.amount), headId: r.head_id ? String(r.head_id) : null, head: r.head ?? null,
    description: String(r.description), voucherNo: r.voucher_no ?? null,
  }));
  const sum = (list: Array<{ amount: number }>) => money(list.reduce((s, x) => s + x.amount, 0));
  const received = sum(receipts), spent = sum(expenditures);
  return {
    heads, receipts, expenditures,
    totals: { sanctioned: money(project.sanctionedAmount ?? 0), budgeted: money(heads.reduce((s, h) => s + h.sanctioned, 0)), received, spent, balance: money(received - spent) },
  };
}

type FundKind = 'heads' | 'receipts' | 'expenditures';
const FUND_TABLE: Record<FundKind, string> = { heads: 'project_budget_heads', receipts: 'project_fund_receipts', expenditures: 'project_expenditures' };
const FUND_NOUN: Record<FundKind, string> = { heads: 'Budget head', receipts: 'Instalment received', expenditures: 'Expenditure' };
export const FUND_KINDS = Object.keys(FUND_TABLE) as FundKind[];

function parseFund(kind: FundKind, body: unknown): { columns: string[]; values: unknown[]; audit: Record<string, unknown> } {
  const v = new Validator(body);
  if (kind === 'heads') {
    const name = v.string('name', { max: 120 });
    const sanctioned = amount(v, 'sanctioned', true);
    const remarks = v.optionalString('remarks', { max: 255 });
    v.assert();
    return { columns: ['name', 'sanctioned_amount', 'remarks'], values: [name, sanctioned, remarks], audit: { head: name, sanctioned, remarks } };
  }
  if (kind === 'receipts') {
    const receivedOn = v.date('receivedOn');
    const value = amount(v, 'amount');
    const reference = v.optionalString('reference', { max: 120 });
    const remarks = v.optionalString('remarks', { max: 255 });
    v.assert();
    return { columns: ['received_on', 'amount', 'reference', 'remarks'], values: [receivedOn, value, reference, remarks], audit: { receivedOn, amount: value, reference, remarks } };
  }
  const spentOn = v.date('spentOn');
  const value = amount(v, 'amount');
  const raw = v.raw('headId');
  const headId = raw === undefined || raw === null || raw === '' ? null : Number(raw);
  if (headId !== null && (!Number.isInteger(headId) || headId <= 0)) v.errors.headId = 'Choose a budget head from the list.';
  const description = v.string('description', { max: 255 });
  const voucherNo = v.optionalString('voucherNo', { max: 60 });
  v.assert();
  return { columns: ['spent_on', 'amount', 'head_id', 'description', 'voucher_no'], values: [spentOn, value, headId, description, voucherNo], audit: { spentOn, amount: value, headId, description, voucherNo } };
}

/** Adds (entryId null) or changes a budget head / instalment / expenditure of the project. */
export async function saveFund(req: Request, id: number, kind: FundKind, entryId: number | null, body: unknown): Promise<Funds> {
  const parsed = parseFund(kind, body);
  return inTransaction(async (conn) => {
    const project = await projectFor(conn, req, id, true);
    const table = FUND_TABLE[kind];
    if (kind === 'heads') {
      const [dup] = await rows(conn, 'SELECT id FROM project_budget_heads WHERE project_id = ? AND LOWER(name) = LOWER(?) AND id <> ? LIMIT 1', [id, parsed.values[0], entryId ?? 0]);
      if (dup) throw badRequest('Please correct the highlighted fields.', { name: 'This project already has this budget head.' });
    }
    if (kind === 'expenditures' && parsed.values[2] !== null) {
      const [head] = await rows(conn, 'SELECT id FROM project_budget_heads WHERE id = ? AND project_id = ? LIMIT 1', [parsed.values[2], id]);
      if (!head) throw badRequest('Please correct the highlighted fields.', { headId: 'Choose a budget head of this project.' });
    }
    let before: Record<string, unknown> | undefined;
    if (entryId) {
      const [row] = await rows(conn, `SELECT * FROM ${table} WHERE id = ? AND project_id = ? FOR UPDATE`, [entryId, id]);
      if (!row) throw notFound(`${FUND_NOUN[kind]} not found.`);
      before = Object.fromEntries(parsed.columns.map((c) => [c, row[c] instanceof Date ? iso(row[c]) : row[c]]));
      await conn.query(`UPDATE ${table} SET ${parsed.columns.map((c) => `${c} = ?`).join(', ')}, updated_by = ? WHERE id = ?`, [...parsed.values, actorOf(req), entryId]);
    } else {
      await conn.query(`INSERT INTO ${table} (project_id, ${parsed.columns.join(', ')}, created_by, updated_by) VALUES (?, ${parsed.columns.map(() => '?').join(', ')}, ?, ?)`,
        [id, ...parsed.values, actorOf(req), actorOf(req)]);
    }
    await writeMasterAuditSql(conn, req, {
      masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: label(project), action: entryId ? 'UPDATE' : 'CREATE',
      before, after: parsed.audit, reason: `${FUND_NOUN[kind]} ${entryId ? 'changed' : 'added'}`,
    });
    return fundsOf(conn, project);
  });
}

export async function deleteFund(req: Request, id: number, kind: FundKind, entryId: number, reason: string | null = null): Promise<Funds> {
  return inTransaction(async (conn) => {
    const project = await projectFor(conn, req, id, true);
    const table = FUND_TABLE[kind];
    const [row] = await rows(conn, `SELECT * FROM ${table} WHERE id = ? AND project_id = ? FOR UPDATE`, [entryId, id]);
    if (!row) throw notFound(`${FUND_NOUN[kind]} not found.`);
    if (kind === 'heads') {
      const [used] = await rows(conn, 'SELECT COUNT(*) AS n FROM project_expenditures WHERE head_id = ?', [entryId]);
      if (Number(used?.n ?? 0) > 0) throw badRequest(`${Number(used.n)} expenditure entr${Number(used.n) === 1 ? 'y uses' : 'ies use'} this head: change them first.`);
    }
    await conn.query(`DELETE FROM ${table} WHERE id = ? AND project_id = ?`, [entryId, id]);
    const before = Object.fromEntries(Object.entries(row).filter(([k]) => !['project_id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(k)).map(([k, x]) => [k, x instanceof Date ? iso(x) : x]));
    await writeMasterAuditSql(conn, req, { masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: label(project), action: 'DELETE', before, reason: [`${FUND_NOUN[kind]} removed`, reason].filter(Boolean).join(' - ') });
    return fundsOf(conn, project);
  });
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export const ACTIVITY_STATUSES = ['planned', 'in_progress', 'on_hold', 'done'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = { planned: 'Planned', in_progress: 'In progress', on_hold: 'On hold', done: 'Done' };
export interface Activity {
  id: string; title: string; description: string | null; startDate: string | null; dueDate: string | null;
  status: ActivityStatus; statusLabel: string; progress: number; updatedAt: string | null;
}

async function activitiesOf(q: Q, projectId: number): Promise<Activity[]> {
  const found = await rows(q,
    `SELECT id, title, description, start_date, due_date, status, progress, updated_at FROM project_activities WHERE project_id = ?
      ORDER BY (status = 'done'), COALESCE(due_date, '9999-12-31'), id`, [projectId]);
  return found.map((r) => {
    const status = (ACTIVITY_STATUSES as readonly string[]).includes(String(r.status)) ? (String(r.status) as ActivityStatus) : 'planned';
    return {
      id: String(r.id), title: String(r.title), description: r.description ?? null, startDate: iso(r.start_date), dueDate: iso(r.due_date),
      status, statusLabel: ACTIVITY_STATUS_LABELS[status], progress: Number(r.progress ?? 0), updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    };
  });
}

export async function projectActivities(req: Request, id: number): Promise<Activity[]> {
  await projectFor(pool, req, id, false);
  return activitiesOf(pool, id);
}

export function parseActivity(body: unknown) {
  const v = new Validator(body);
  const title = v.string('title', { max: 200 });
  const description = v.optionalString('description', { max: 5000 });
  const startDate = v.date('startDate', false);
  const dueDate = v.date('dueDate', false);
  if (startDate && dueDate && dueDate < startDate) v.errors.dueDate ||= 'The due date must be on or after the start date.';
  const status = (v.oneOf('status', ACTIVITY_STATUSES, false) ?? 'planned') as ActivityStatus;
  let progress = v.int('progress', { required: false, min: 0, max: 100 }) ?? 0;
  if (status === 'done') progress = 100;
  v.assert();
  return { title, description, startDate, dueDate, status, progress };
}

export async function saveActivity(req: Request, id: number, entryId: number | null, body: unknown): Promise<Activity[]> {
  const a = parseActivity(body);
  return inTransaction(async (conn) => {
    const project = await projectFor(conn, req, id, true);
    let before: Record<string, unknown> | undefined;
    if (entryId) {
      const [row] = await rows(conn, 'SELECT title, description, start_date, due_date, status, progress FROM project_activities WHERE id = ? AND project_id = ? FOR UPDATE', [entryId, id]);
      if (!row) throw notFound('Activity not found.');
      before = { title: row.title, description: row.description, startDate: iso(row.start_date), dueDate: iso(row.due_date), status: row.status, progress: Number(row.progress) };
      await conn.query('UPDATE project_activities SET title = ?, description = ?, start_date = ?, due_date = ?, status = ?, progress = ?, updated_by = ? WHERE id = ?',
        [a.title, a.description, a.startDate, a.dueDate, a.status, a.progress, actorOf(req), entryId]);
    } else {
      await conn.query('INSERT INTO project_activities (project_id, title, description, start_date, due_date, status, progress, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, a.title, a.description, a.startDate, a.dueDate, a.status, a.progress, actorOf(req), actorOf(req)]);
    }
    await writeMasterAuditSql(conn, req, {
      masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: label(project), action: entryId ? 'UPDATE' : 'CREATE',
      before, after: { ...a }, reason: `Activity ${entryId ? 'changed' : 'added'}`,
    });
    return activitiesOf(conn, id);
  });
}

export async function deleteActivity(req: Request, id: number, entryId: number, reason: string | null = null): Promise<Activity[]> {
  return inTransaction(async (conn) => {
    const project = await projectFor(conn, req, id, true);
    const [row] = await rows(conn, 'SELECT title, status, progress FROM project_activities WHERE id = ? AND project_id = ? FOR UPDATE', [entryId, id]);
    if (!row) throw notFound('Activity not found.');
    await conn.query('DELETE FROM project_activities WHERE id = ? AND project_id = ?', [entryId, id]);
    await writeMasterAuditSql(conn, req, { masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: label(project), action: 'DELETE', before: { activity: row.title, status: row.status, progress: Number(row.progress) }, reason: ['Activity removed', reason].filter(Boolean).join(' - ') });
    return activitiesOf(conn, id);
  });
}

// ---------------------------------------------------------------------------
// Other documents (PDF, up to 8 MB), next to the proposal and the sanction order
// ---------------------------------------------------------------------------

export interface ProjectDocument { id: string; title: string; fileName: string; size: number; uploadedAt: string; uploadedBy: string | null }

async function documentsOf(q: Q, projectId: number): Promise<ProjectDocument[]> {
  const found = await rows(q,
    `SELECT d.id, d.title, d.file_name, d.size_bytes, d.uploaded_at, u.name AS uploader FROM project_documents d
       LEFT JOIN users u ON u.biometric_id = d.uploaded_by WHERE d.project_id = ? ORDER BY d.uploaded_at DESC, d.id DESC`, [projectId]);
  return found.map((r) => ({ id: String(r.id), title: String(r.title), fileName: String(r.file_name), size: Number(r.size_bytes), uploadedAt: new Date(r.uploaded_at).toISOString(), uploadedBy: r.uploader ?? null }));
}

export async function projectDocuments(req: Request, id: number): Promise<ProjectDocument[]> {
  await projectFor(pool, req, id, false);
  return documentsOf(pool, id);
}

export async function addDocument(req: Request, id: number, body: unknown): Promise<ProjectDocument[]> {
  const v = new Validator(body);
  const title = v.string('title', { max: 160 });
  v.assert();
  const { name, data } = (body ?? {}) as { name?: unknown; data?: unknown };
  const fail = (message: string) => badRequest('Please correct the highlighted fields.', { file: message });
  const match = typeof data === 'string' ? /^data:[a-z0-9+./-]*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(data) : null;
  if (!match) throw fail('The file could not be read.');
  const bytes = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  if (!bytes.length) throw fail('The file is empty.');
  if (bytes.length > PROJECT_FILE_MAX_BYTES) throw fail('Use a PDF smaller than 8 MB.');
  if (bytes.toString('ascii', 0, 5) !== '%PDF-') throw fail('The document must be a PDF file.');
  const cleaned = (typeof name === 'string' ? name : '').replace(/[\\/\r\n"]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120).replace(/\.pdf$/i, '');
  const fileName = `${cleaned || 'document'}.pdf`;
  return inTransaction(async (conn) => {
    const project = await projectFor(conn, req, id, true);
    const stored = await storeBlob('projects', `project-${id}-doc`, 'pdf', bytes);
    await conn.query(
      `INSERT INTO project_documents (project_id, title, file_name, mime_type, size_bytes, data, storage_path, uploaded_by) VALUES (?, ?, ?, 'application/pdf', ?, ?, ?, ?)`,
      [id, title, fileName, bytes.length, stored.data, stored.storagePath, actorOf(req)]);
    await writeMasterAuditSql(conn, req, { masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: label(project), action: 'CREATE', after: { document: title, file: fileName }, reason: 'Document uploaded' });
    return documentsOf(conn, id);
  });
}

export async function loadDocument(req: Request, id: number, docId: number): Promise<{ name: string; data: Buffer }> {
  await projectFor(pool, req, id, false);
  const [row] = await rows(pool, 'SELECT file_name, data, storage_path FROM project_documents WHERE id = ? AND project_id = ? LIMIT 1', [docId, id]);
  if (!row) throw notFound('Document not found.');
  const data = await readBlob(row);
  if (!data || data.toString('ascii', 0, 5) !== '%PDF-') throw notFound('The document file could not be found.');
  return { name: String(row.file_name), data };
}

export async function removeDocument(req: Request, id: number, docId: number, reason: string | null = null): Promise<ProjectDocument[]> {
  return inTransaction(async (conn) => {
    const project = await projectFor(conn, req, id, true);
    const [row] = await rows(conn, 'SELECT title, file_name FROM project_documents WHERE id = ? AND project_id = ? FOR UPDATE', [docId, id]);
    if (!row) throw notFound('Document not found.');
    await conn.query('DELETE FROM project_documents WHERE id = ? AND project_id = ?', [docId, id]);
    await writeMasterAuditSql(conn, req, { masterKey: PROJECT_AUDIT_KEY, recordId: id, recordLabel: label(project), action: 'DELETE', before: { document: row.title, file: row.file_name }, reason: ['Document removed', reason].filter(Boolean).join(' - ') });
    return documentsOf(conn, id);
  });
}

export { idParam };

/** The optional reason sent with a removal (saved in the audit log). */
export const reasonOf = (body: unknown): string | null => {
  const r = (body as { reason?: unknown } | null)?.reason;
  return typeof r === 'string' && r.trim() ? r.trim().slice(0, 500) : null;
};
