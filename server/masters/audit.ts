import type { Request } from 'express';
import { db } from '../../src/db';
import { master_audit_logs } from '../../src/db/schema';

/**
 * Every change to any master goes through writeMasterAudit, inside the same
 * transaction as the change itself, so a change and its audit record are
 * saved together or not at all.
 */

export type AuditAction = 'CREATE' | 'UPDATE' | 'STATUS' | 'DELETE';
type Executor = Pick<typeof db, 'insert'>;

export interface AuditEntry {
  masterKey: string;
  recordId: string | number;
  recordLabel?: string | null;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}

/** Fields never worth recording as a "change". */
const IGNORED_FIELDS = new Set(['createdAt', 'updatedAt', 'created_at', 'updated_at']);
/** Large values (e.g. a base64 logo) are summarised instead of stored in full. */
const MAX_VALUE_LENGTH = 2000;

function stable(value: unknown): string {
  if (value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Names of fields whose value differs between before and after. */
export function changedFields(before?: Record<string, unknown> | null, after?: Record<string, unknown> | null): string[] {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => !IGNORED_FIELDS.has(k) && k in after && stable(before[k]) !== stable(after[k])).sort();
}

export function snapshot(data?: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (IGNORED_FIELDS.has(key)) continue;
    if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
      out[key] = `[${value.length} characters${value.startsWith('data:') ? ', image data' : ''}]`;
    } else {
      out[key] = value instanceof Date ? value.toISOString() : value;
    }
  }
  return JSON.stringify(out);
}

export async function writeMasterAudit(executor: Executor, req: Request, entry: AuditEntry): Promise<void> {
  const fields = entry.action === 'UPDATE' || entry.action === 'STATUS' ? changedFields(entry.before, entry.after) : [];
  await executor.insert(master_audit_logs).values({
    masterKey: entry.masterKey,
    recordId: String(entry.recordId),
    recordLabel: entry.recordLabel ? String(entry.recordLabel).slice(0, 255) : null,
    action: entry.action,
    changedFields: fields.length ? fields.join(',') : null,
    beforeData: snapshot(entry.before),
    afterData: snapshot(entry.after),
    reason: entry.reason ? String(entry.reason).slice(0, 500) : null,
    actorBiometricId: req.auth?.account.biometricId ?? null,
    actorName: req.auth?.account.name ?? null,
    actorRole: req.auth?.activeRole ?? null,
    ipAddress: (req.ip || '').slice(0, 45) || null,
  });
}

/** Minimal shape of a mysql2 connection (or pool) for raw-SQL transactions. */
export interface SqlExecutor {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}

/** Same as writeMasterAudit, for code that runs raw SQL on a mysql2 connection. */
export async function writeMasterAuditSql(conn: SqlExecutor, req: Request, entry: AuditEntry): Promise<void> {
  const fields = entry.action === 'UPDATE' || entry.action === 'STATUS' ? changedFields(entry.before, entry.after) : [];
  await conn.query(
    `INSERT INTO master_audit_logs
       (master_key, record_id, record_label, action, changed_fields, before_data, after_data, reason,
        actor_biometric_id, actor_name, actor_role, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.masterKey,
      String(entry.recordId),
      entry.recordLabel ? String(entry.recordLabel).slice(0, 255) : null,
      entry.action,
      fields.length ? fields.join(',') : null,
      snapshot(entry.before),
      snapshot(entry.after),
      entry.reason ? String(entry.reason).slice(0, 500) : null,
      req.auth?.account.biometricId ?? null,
      req.auth?.account.name ?? null,
      req.auth?.activeRole ?? null,
      (req.ip || '').slice(0, 45) || null,
    ],
  );
}
