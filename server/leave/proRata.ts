import { profileJsonSql } from '../employees/profileSql';
import type { Request } from 'express';
import { pool } from '../../src/db';
import { todayInIndia } from '../lib/validate';
import { writeMasterAuditSql } from '../masters/audit';
import { layoutOfEmployeeType } from '../employees/references';
import { groupLeaveTypeIds } from './groups';
import { BALANCE_KEY, eligibilityProblem, isoDate, loadPolicy, profileData, quotaFor, rows } from './requests';
import { PRO_RATA_LAYOUTS, type Basis, type ProRataChange, cycleYearFor, daysToAdd, leaveYearRange, spanLabel } from './proRataRules';

export { spanForNewEmployee, spansForExtension } from './proRataRules';

/**
 * Automatic pro-rata leave quota for Contract, Project staff, PhD scholars and Interns (rules: proRataRules.ts).
 *
 * Credited (added to leave_balances.total of the running leave year, audited as 'leave_balance'):
 *  - when the employee is created (form or bulk import): the months from joining to "Valid up to";
 *  - when "Valid up to" is extended (this also reactivates an expired account): only the new months;
 *  - every day at start-up / hourly: an active employee with no balance yet for the running leave year
 *    (a new leave year has begun) gets the months of that year up to "Valid up to".
 * Leave types: those of the employee's leave group that are debited, active, have a quota for the employee type
 * and that the employee is eligible for. Leave already taken and balances set by hand are never reduced.
 */

type Q = { query: typeof pool.query };

export interface Person {
  id: number; biometricId: string; name: string; status: string; employmentType: string; gender: string;
  joining: string | null; validUpto: string | null; basis: Basis; isPwd: boolean; group: unknown;
}

export async function loadPerson(q: Q, userId: number): Promise<Person | null> {
  const [row] = await rows(q,
    `SELECT u.id, u.biometric_id, u.name, u.status, u.valid_upto, p.employment_type, p.joining_date, ${profileJsonSql('p')} AS profile_data
       FROM users u LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [userId]);
  if (!row) return null;
  const data = profileData(row.profile_data);
  return {
    id: Number(row.id), biometricId: String(row.biometric_id ?? ''), name: String(row.name ?? ''), status: String(row.status ?? '').toLowerCase(),
    employmentType: String(row.employment_type ?? ''), gender: String(data.gender ?? ''),
    joining: row.joining_date ? isoDate(row.joining_date) : null, validUpto: row.valid_upto ? isoDate(row.valid_upto) : null,
    basis: data.leaveCycle === 'FY' ? 'FY' : 'CY', isPwd: data.isPwd === true || data.isPwd === 'true', group: data.leaveGroup,
  };
}

/** Leave types that get a pro-rata quota for this person, with the yearly quota. Empty when the person is out of scope. */
export async function quotaTypes(q: Q, p: Person): Promise<Array<{ id: number; code: string; quota: number }>> {
  const layout = await layoutOfEmployeeType(q, p.employmentType);
  if (!layout || !PRO_RATA_LAYOUTS.has(layout)) return [];
  const ids = await groupLeaveTypeIds(q, p.group);
  if (!ids || !ids.size) return [];
  const out: Array<{ id: number; code: string; quota: number }> = [];
  for (const id of ids) {
    const policy = await loadPolicy(q, id);
    if (!policy || policy.status.toLowerCase() !== 'active' || !policy.debited) continue;
    // Service length is not checked here: the quota is credited, the leave rules still apply when applying.
    if (eligibilityProblem(policy, { employmentType: p.employmentType, gender: p.gender, joining: null, isPwd: p.isPwd }, todayInIndia())) continue;
    const quota = quotaFor(policy, p.employmentType, p.isPwd);
    if (quota > 0) out.push({ id: policy.id, code: policy.code, quota });
  }
  return out;
}

/** A request-like actor for the audit log of the background job. */
const SYSTEM_ACTOR = { ip: '', auth: { account: { biometricId: null, name: 'System (automatic pro-rata)' }, activeRole: null } } as unknown as Request;


/**
 * Adds the pro-rata days of `change` to the running leave year's balances, inside the caller's transaction.
 * Returns the number of balances changed. Does nothing for employees outside the four types.
 */
export async function creditProRata(conn: Q, req: Request | null, userId: number, change: ProRataChange, today = todayInIndia()): Promise<number> {
  const p = await loadPerson(conn, userId);
  if (!p || p.status !== 'active') return 0;
  const types = await quotaTypes(conn, p);
  if (!types.length) return 0;
  const cycleYear = cycleYearFor(today, p.basis);
  const year = leaveYearRange(cycleYear, p.basis);
  let changed = 0;
  for (const t of types) {
    const { days, monthsBefore, monthsAfter } = daysToAdd(t.quota, change.before, change.added, year);
    if (days <= 0) continue;
    const [existing] = await rows(conn,
      'SELECT total FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? LIMIT 1', [p.id, t.id, cycleYear]);
    if (existing && change.onlyMissing) continue;
    const beforeTotal = existing ? Number(existing.total) : null;
    await conn.query(
      `INSERT INTO leave_balances (user_id, leave_type_id, cycle_year, total, carry_forward, cycle_type) VALUES (?, ?, ?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE total = total + VALUES(total)`,
      [p.id, t.id, cycleYear, days, p.basis]);
    const yearLabel = p.basis === 'FY' ? `${cycleYear}-${String((cycleYear + 1) % 100).padStart(2, '0')}` : String(cycleYear);
    await writeMasterAuditSql(conn, req ?? SYSTEM_ACTOR, {
      masterKey: BALANCE_KEY, recordId: `${p.id}:${t.id}:${cycleYear}`,
      recordLabel: `${p.name} (${p.biometricId}) · ${t.code} · ${yearLabel}`,
      action: existing ? 'UPDATE' : 'CREATE',
      before: existing ? { total: beforeTotal } : undefined,
      after: { total: (beforeTotal ?? 0) + days, added: days, months: `${monthsBefore} → ${monthsAfter}`, period: spanLabel(change.added, year), yearlyQuota: t.quota },
      reason: `Automatic pro-rata (${t.quota} × ${monthsAfter - monthsBefore}/12, every started month, nearest ½ day): ${change.reason}`,
    });
    changed += 1;
  }
  return changed;
}

/** Active employees of the four types with no balance for the running leave year yet: credit that year. */
export async function creditNewLeaveYear(today = todayInIndia()): Promise<number> {
  const found = await rows(pool,
    `SELECT u.id FROM users u JOIN employee_profiles p ON p.biometric_id = u.biometric_id
      WHERE LOWER(u.status) = 'active' AND u.is_system = 0 AND (u.valid_upto IS NULL OR u.valid_upto >= ?)`, [today]);
  let changed = 0;
  for (const r of found) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const p = await loadPerson(conn, Number(r.id));
      if (p) {
        const year = leaveYearRange(cycleYearFor(today, p.basis), p.basis);
        const from = p.joining && p.joining > year.from ? p.joining : year.from;
        changed += await creditProRata(conn, null, p.id, {
          before: [], added: { from, to: p.validUpto || year.to }, onlyMissing: true,
          reason: `leave year starting ${year.from}`,
        }, today);
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback().catch(() => undefined);
      throw error;
    } finally {
      conn.release();
    }
  }
  return changed;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Runs the new-leave-year credit at start-up and every hour (it only writes when a balance is missing). */
export function startProRataJob(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const n = await creditNewLeaveYear();
      if (n) console.log(`[leave] Pro-rata quota credited to ${n} balance${n === 1 ? '' : 's'} for the running leave year.`);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') return;
      console.warn('[leave] Could not credit pro-rata quota:', error instanceof Error ? error.message : error);
    }
  };
  void tick();
  timer = setInterval(() => void tick(), 60 * 60_000);
  timer.unref?.();
}
