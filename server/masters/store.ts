import type { Request } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { HttpError, badRequest, notFound } from '../lib/http';
import { writeMasterAuditSql } from './audit';
import {
  FORM_LAYOUTS, MASTERS, MasterDef, auditKey, describeUsage, findMaster, findUsage,
} from './definitions';

/**
 * Reading and writing simple masters. Table names come only from the
 * registry in definitions.ts, never from the request.
 */

export type MasterStatus = 'ACTIVE' | 'INACTIVE';

export interface MasterRecord {
  id: string;
  name: string;
  code: string;
  status: MasterStatus;
  sortOrder?: number;
  fields: Record<string, string>;
  updatedAt: string | null;
}

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._/&()-]*$/;

function parseJson(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toRecord(def: MasterDef, row: RowDataPacket): MasterRecord {
  const meta = parseJson(row.metadata);
  const fields: Record<string, string> = {};
  for (const field of def.fields) {
    const column = def.kind === 'table' ? def.columnFields?.[field.key] : undefined;
    const raw = column ? row[column] : meta[field.key];
    fields[field.key] = raw === undefined || raw === null ? '' : String(raw);
  }
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    code: String(row.code ?? ''),
    status: String(row.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    ...(def.kind === 'lookup' ? { sortOrder: Number(row.sort_order ?? 0) } : {}),
    fields,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type Querier = Pick<PoolConnection, 'query'> | typeof pool;

async function selectRows(def: MasterDef, where = '', params: unknown[] = [], q: Querier = pool): Promise<RowDataPacket[]> {
  if (def.kind === 'lookup') {
    const [rows] = await q.query<RowDataPacket[]>(
      `SELECT * FROM lookup_values WHERE lookup_type = ? ${where} ORDER BY sort_order, name`,
      [def.lookupType, ...params],
    );
    return rows;
  }
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT * FROM ${def.table} WHERE 1=1 ${where} ORDER BY name`,
    params,
  );
  return rows;
}

export async function listRecords(def: MasterDef, { activeOnly = false } = {}): Promise<MasterRecord[]> {
  const rows = await selectRows(def, activeOnly ? "AND UPPER(status) = 'ACTIVE'" : '');
  return rows.map((row) => toRecord(def, row));
}

async function getRecord(def: MasterDef, id: number, q: Querier = pool): Promise<MasterRecord | null> {
  const rows = await selectRows(def, 'AND id = ?', [id], q);
  return rows[0] ? toRecord(def, rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface CleanInput {
  name: string;
  code: string;
  status: MasterStatus;
  sortOrder: number;
  fields: Record<string, string>;
}

async function lookupCodeExists(lookupType: string, code: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM lookup_values WHERE lookup_type = ? AND code = ? AND UPPER(status) = 'ACTIVE' LIMIT 1",
    [lookupType, code],
  );
  return rows.length > 0;
}

async function masterNameExists(masterKey: string, name: string): Promise<boolean> {
  const def = findMaster(masterKey);
  if (!def) return false;
  const rows = await selectRows(def, "AND name = ? AND UPPER(status) = 'ACTIVE'", [name]);
  return rows.length > 0;
}

async function validate(def: MasterDef, body: unknown, existing: MasterRecord | null): Promise<CleanInput> {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) errors.name = 'Name is required.';
  else if (name.length > 255) errors.name = 'Name must be at most 255 characters.';

  // Lookup codes are what records store, so they are fixed once created.
  let code = typeof input.code === 'string' ? input.code.trim() : '';
  if (def.kind === 'table') code = code.toUpperCase();
  if (def.kind === 'lookup' && existing) code = existing.code;
  const codeMax = def.kind === 'table' ? def.codeMaxLength : 50;
  if (!code) errors.code = 'Code is required.';
  else if (code.length > codeMax) errors.code = `Code must be at most ${codeMax} characters.`;
  else if (!CODE_PATTERN.test(code)) errors.code = 'Use letters, numbers and . _ / & ( ) - only.';

  const statusRaw = typeof input.status === 'string' ? input.status.toUpperCase() : existing?.status ?? 'ACTIVE';
  if (statusRaw !== 'ACTIVE' && statusRaw !== 'INACTIVE') errors.status = 'Status must be Active or Inactive.';
  const status = statusRaw as MasterStatus;

  const sortOrderRaw = input.sortOrder ?? existing?.sortOrder ?? 0;
  const sortOrder = Number(sortOrderRaw);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) errors.sortOrder = 'Order must be a whole number.';

  const rawFields = (input.fields && typeof input.fields === 'object' ? input.fields : {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const field of def.fields) {
    const value = typeof rawFields[field.key] === 'string' ? (rawFields[field.key] as string).trim() : '';
    fields[field.key] = value;
    if (!value) {
      if (field.required) errors[`fields.${field.key}`] = `${field.label} is required.`;
      continue;
    }
    // An unchanged value is accepted even if its option was since deactivated.
    const unchanged = existing?.fields[field.key] === value;
    if (field.type === 'text' && value.length > (field.maxLength ?? 255)) {
      errors[`fields.${field.key}`] = `${field.label} must be at most ${field.maxLength ?? 255} characters.`;
    } else if (field.type === 'layout' && !FORM_LAYOUTS.some((l) => l.code === value)) {
      errors[`fields.${field.key}`] = 'Choose a form layout from the list.';
    } else if (field.type === 'lookup' && !unchanged && !(await lookupCodeExists(field.lookupType!, value))) {
      errors[`fields.${field.key}`] = `${field.label} must be chosen from its active list.`;
    } else if (field.type === 'master' && !unchanged && !(await masterNameExists(field.masterKey!, value))) {
      errors[`fields.${field.key}`] = `${field.label} must be chosen from its active master.`;
    }
  }

  if (!errors.name) {
    const dupName = await selectRows(def, 'AND LOWER(name) = LOWER(?) AND id <> ?', [name, existing ? Number(existing.id) : 0]);
    if (dupName.length) errors.name = `Another ${def.noun.toLowerCase()} already has this name.`;
  }
  if (!errors.code && (!existing || existing.code !== code)) {
    const dupCode = await selectRows(def, 'AND code = ? AND id <> ?', [code, existing ? Number(existing.id) : 0]);
    if (dupCode.length) errors.code = `Another ${def.noun.toLowerCase()} already uses this code.`;
  }

  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
  return { name, code, status, sortOrder, fields };
}

// ---------------------------------------------------------------------------
// Writes (each in one transaction with its audit entry)
// ---------------------------------------------------------------------------

async function inTransaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}

function auditView(record: MasterRecord): Record<string, unknown> {
  return {
    name: record.name, code: record.code, status: record.status,
    ...(record.sortOrder !== undefined ? { sortOrder: record.sortOrder } : {}),
    ...record.fields,
  };
}

function storageValues(def: MasterDef, input: CleanInput): { columns: string[]; values: unknown[] } {
  if (def.kind === 'lookup') {
    return {
      columns: ['lookup_type', 'code', 'name', 'sort_order', 'status', 'metadata'],
      values: [def.lookupType, input.code, input.name, input.sortOrder, input.status, JSON.stringify(input.fields)],
    };
  }
  const columns = ['name', 'code', 'status'];
  const values: unknown[] = [input.name, input.code, input.status];
  const metadata: Record<string, string> = {};
  for (const field of def.fields) {
    const column = def.columnFields?.[field.key];
    if (column) {
      columns.push(column);
      values.push(input.fields[field.key]);
    } else if (input.fields[field.key]) {
      metadata[field.key] = input.fields[field.key];
    }
  }
  if (def.hasMetadata) {
    columns.push('metadata');
    values.push(JSON.stringify(metadata));
  }
  return { columns, values };
}

const tableOf = (def: MasterDef) => (def.kind === 'lookup' ? 'lookup_values' : def.table);

export async function createRecord(def: MasterDef, body: unknown, req: Request): Promise<MasterRecord> {
  const input = await validate(def, body, null);
  const { columns, values } = storageValues(def, input);
  return inTransaction(async (conn) => {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO ${tableOf(def)} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values,
    );
    const saved = (await getRecord(def, result.insertId, conn))!;
    await writeMasterAuditSql(conn, req, {
      masterKey: auditKey(def), recordId: saved.id, recordLabel: `${saved.name} (${saved.code})`,
      action: 'CREATE', after: auditView(saved), reason: reasonOf(body),
    });
    return saved;
  });
}

export async function updateRecord(def: MasterDef, id: number, body: unknown, req: Request): Promise<MasterRecord> {
  const existing = await getRecord(def, id);
  if (!existing) throw notFound(`${def.noun} not found.`);
  const input = await validate(def, body, existing);

  // Profile masters are referenced by name, so a name or code in use cannot
  // change without leaving those records pointing at nothing. Lists (lookups)
  // are referenced by their code, which never changes, so renaming is safe.
  const renaming = input.name !== existing.name || input.code !== existing.code;
  if (renaming && def.kind === 'table') {
    const usage = await findUsage(def, existing);
    if (usage.length > 0) {
      throw new HttpError(409, `This ${def.noun.toLowerCase()} is used by ${describeUsage(usage)}, so its name and code cannot be changed. Create a new one and deactivate this one instead.`, 'IN_USE');
    }
  }

  const { columns, values } = storageValues(def, input);
  return inTransaction(async (conn) => {
    const sets = columns.filter((c) => c !== 'lookup_type').map((c) => `${c} = ?`);
    const vals = def.kind === 'lookup' ? values.slice(1) : values;
    await conn.query(`UPDATE ${tableOf(def)} SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    const saved = (await getRecord(def, id, conn))!;
    await writeMasterAuditSql(conn, req, {
      masterKey: auditKey(def), recordId: saved.id, recordLabel: `${saved.name} (${saved.code})`,
      action: existing.status !== saved.status && !renaming ? 'STATUS' : 'UPDATE',
      before: auditView(existing), after: auditView(saved), reason: reasonOf(body),
    });
    return saved;
  });
}

export async function setStatus(def: MasterDef, id: number, status: unknown, req: Request, reason?: unknown): Promise<MasterRecord> {
  const next = typeof status === 'string' ? status.toUpperCase() : '';
  if (next !== 'ACTIVE' && next !== 'INACTIVE') throw badRequest('Status must be Active or Inactive.');
  const existing = await getRecord(def, id);
  if (!existing) throw notFound(`${def.noun} not found.`);
  if (existing.status === next) return existing;
  return inTransaction(async (conn) => {
    await conn.query(`UPDATE ${tableOf(def)} SET status = ? WHERE id = ?`, [next, id]);
    const saved = (await getRecord(def, id, conn))!;
    await writeMasterAuditSql(conn, req, {
      masterKey: auditKey(def), recordId: saved.id, recordLabel: `${saved.name} (${saved.code})`,
      action: 'STATUS', before: auditView(existing), after: auditView(saved), reason: reasonOf({ reason }),
    });
    return saved;
  });
}

export async function deleteRecord(def: MasterDef, id: number, req: Request, reason?: unknown): Promise<void> {
  const existing = await getRecord(def, id);
  if (!existing) throw notFound(`${def.noun} not found.`);
  const usage = await findUsage(def, existing);
  if (usage.length) {
    throw new HttpError(409, `This ${def.noun.toLowerCase()} is used by ${describeUsage(usage)} and cannot be deleted. Make it Inactive instead.`, 'IN_USE');
  }
  await inTransaction(async (conn) => {
    await writeMasterAuditSql(conn, req, {
      masterKey: auditKey(def), recordId: existing.id, recordLabel: `${existing.name} (${existing.code})`,
      action: 'DELETE', before: auditView(existing), reason: reasonOf({ reason }),
    });
    await conn.query(`DELETE FROM ${tableOf(def)} WHERE id = ?`, [id]);
  });
}

function reasonOf(body: unknown): string | null {
  const reason = (body as { reason?: unknown })?.reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null;
}

/** Active values of every master, keyed by master key, for form dropdowns. */
export async function activeOptions(): Promise<Record<string, MasterRecord[]>> {
  const out: Record<string, MasterRecord[]> = {};
  await Promise.all(MASTERS.map(async (def) => {
    out[def.key] = await listRecords(def, { activeOnly: true });
  }));
  return out;
}
