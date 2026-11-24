import type { Request } from 'express';
import { pool } from '../../src/db';
import { badRequest, forbidden } from '../lib/http';
import { inTransaction } from '../lib/tx';
import { canManageBalances } from '../lib/roles';
import { inScope } from '../lib/peopleScope';
import { todayInIndia } from '../lib/validate';
import { writeMasterAuditSql } from '../masters/audit';
import { type Person, loadPerson, quotaTypes } from './proRata';
import { expectedCredit, spanLabel } from './proRataRules';
import { BALANCE_KEY, type Viewer, balanceOf, num, rows } from './requests';

/**
 * Reconcile leave (Leave Balance → "Reconcile leave"): the pro-rata quota each employee should have for a leave
 * year, worked out again from the rules (proRataRules.ts: yearly quota × months from joining to "Valid up to" within
 * the year ÷ 12, every started month, nearest ½ day), against the days credited in leave_balances.
 *
 *  - preview: every leave type whose credited days differ from the rule (or that has no balance at all), never writes;
 *  - apply:   sets the credited days of the rows the administrator ticked to the rule's value, each one audited.
 * Only the employees whose leave is pro-rata (Contract, Project staff, PhD, Intern) and only the viewer's module.
 * Carry forward, the "as on" date and the leave taken are not touched. A row is skipped when the new credit would be
 * below the leave already taken or waiting (that is a No Dues matter, not a balance correction).
 */

export interface ReconcileRow {
  userId: string; biometricId: string; name: string; employmentType: string;
  leaveTypeId: string; code: string; cycleYear: number; cycle: string; period: string;
  yearlyQuota: number; credited: number | null; expected: number; difference: number;
  carryForward: number; usedOrPending: number; asOf: string | null;
  /** Why the row cannot be applied, or null. */
  problem: string | null;
}

const cycleText = (year: number, basis: 'CY' | 'FY') => (basis === 'FY' ? `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}` : `CY ${year}`);

/** The rule's credit for one person and leave type in the leave year `cycleYear` (of their own CY / FY basis). */
const expectedFor = (p: Person, quota: number, cycleYear: number) =>
  expectedCredit({ joining: p.joining, validUpto: p.validUpto, basis: p.basis, quota, cycleYear });

async function rowsFor(q: { query: typeof pool.query }, p: Person, cycleYear: number): Promise<ReconcileRow[]> {
  const out: ReconcileRow[] = [];
  for (const t of await quotaTypes(q, p)) {
    const e = expectedFor(p, t.quota, cycleYear);
    if (!e) continue;
    const [grant] = await rows(q,
      "SELECT total, carry_forward, DATE_FORMAT(as_of, '%Y-%m-%d') AS as_of FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? LIMIT 1",
      [p.id, t.id, cycleYear]).catch(() => rows(q, 'SELECT total, carry_forward, NULL AS as_of FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND cycle_year = ? LIMIT 1', [p.id, t.id, cycleYear]));
    const credited = grant ? Number(grant.total) : null;
    if (credited !== null && credited === e.days) continue;
    const b = await balanceOf(q, p.id, { id: t.id, quota: t.quota }, cycleYear);
    const carryForward = grant ? Number(grant.carry_forward) : 0;
    const usedOrPending = num(b.used + b.pending);
    const problem = e.days + carryForward < usedOrPending
      ? `Leave taken or waiting (${usedOrPending} days) is more than the rule allows (${num(e.days + carryForward)}): use No Dues / recovery instead.`
      : null;
    out.push({
      userId: String(p.id), biometricId: p.biometricId, name: p.name, employmentType: p.employmentType,
      leaveTypeId: String(t.id), code: t.code, cycleYear, cycle: cycleText(cycleYear, p.basis), period: spanLabel(e.span, e.year),
      yearlyQuota: t.quota, credited, expected: e.days, difference: num(e.days - (credited ?? 0)),
      carryForward, usedOrPending, asOf: grant?.as_of ? String(grant.as_of) : null, problem,
    });
  }
  return out;
}

function parseYear(raw: unknown): number {
  const year = raw === undefined || raw === '' ? Number(todayInIndia().slice(0, 4)) : Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest('Choose a year between 2000 and 2100.');
  return year;
}

function assertAllowed(viewer: Viewer): void {
  if (!canManageBalances(viewer.role)) throw forbidden('Only an administrator or Leave Balance Manager can reconcile leave.');
}

/** The pro-rata employees of the viewer's module that are active now. */
async function people(): Promise<number[]> {
  const found = await rows(pool, "SELECT id FROM users WHERE LOWER(status) = 'active' AND is_system = 0 ORDER BY name");
  return found.map((r) => Number(r.id));
}

export async function reconcilePreview(viewer: Viewer, yearRaw: unknown): Promise<{ year: number; rows: ReconcileRow[]; checked: number }> {
  assertAllowed(viewer);
  const year = parseYear(yearRaw);
  const out: ReconcileRow[] = [];
  let checked = 0;
  for (const id of await people()) {
    if (!inScope(viewer, id)) continue;
    const p = await loadPerson(pool, id);
    if (!p) continue;
    const found = await rowsFor(pool, p, year);
    if ((await quotaTypes(pool, p)).length) checked += 1;
    out.push(...found);
  }
  return { year, rows: out, checked };
}

export async function reconcileApply(req: Request, viewer: Viewer, body: unknown): Promise<{ year: number; applied: number; skipped: Array<{ name: string; code: string; reason: string }> }> {
  assertAllowed(viewer);
  const input = (body ?? {}) as { year?: unknown; items?: unknown };
  const year = parseYear(input.year);
  const items = Array.isArray(input.items) ? input.items.slice(0, 5000) : [];
  const wanted = new Set(items.map((i) => `${Number((i as { userId?: unknown })?.userId)}:${Number((i as { leaveTypeId?: unknown })?.leaveTypeId)}`));
  if (!wanted.size) throw badRequest('Tick the rows to correct.');
  const userIds = [...new Set([...wanted].map((k) => Number(k.split(':')[0])))].filter((id) => Number.isInteger(id) && id > 0);
  return inTransaction(async (conn) => {
    let applied = 0;
    const skipped: Array<{ name: string; code: string; reason: string }> = [];
    for (const id of userIds) {
      if (!inScope(viewer, id)) { skipped.push({ name: String(id), code: '', reason: 'belongs to the other module (HRMS / PMS)' }); continue; }
      await rows(conn, 'SELECT id FROM users WHERE id = ? FOR UPDATE', [id]);
      const p = await loadPerson(conn, id);
      if (!p) continue;
      // Worked out again here: the browser only says which rows; the values come from the rules.
      for (const r of await rowsFor(conn, p, year)) {
        if (!wanted.has(`${r.userId}:${r.leaveTypeId}`)) continue;
        if (r.problem) { skipped.push({ name: r.name, code: r.code, reason: r.problem }); continue; }
        await conn.query(
          `INSERT INTO leave_balances (user_id, leave_type_id, cycle_year, total, carry_forward, cycle_type) VALUES (?, ?, ?, ?, 0, ?)
             ON DUPLICATE KEY UPDATE total = VALUES(total)`,
          [p.id, Number(r.leaveTypeId), year, r.expected, p.basis]);
        await writeMasterAuditSql(conn, req, {
          masterKey: BALANCE_KEY, recordId: `${p.id}:${r.leaveTypeId}:${year}`,
          recordLabel: `${p.name} (${p.biometricId}) · ${r.code} · ${r.cycle}`,
          action: r.credited === null ? 'CREATE' : 'UPDATE',
          before: r.credited === null ? undefined : { total: r.credited },
          after: { total: r.expected, period: r.period, yearlyQuota: r.yearlyQuota },
          reason: `Reconcile leave: pro-rata rule (${r.yearlyQuota} a year, ${r.period}) gives ${r.expected} days; ${r.credited === null ? 'no balance was credited' : `${r.credited} were credited`}.`,
        });
        applied += 1;
      }
    }
    return { year, applied, skipped };
  });
}
