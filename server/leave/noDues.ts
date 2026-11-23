import type { Request } from 'express';
import { pool } from '../../src/db';
import { badRequest, notFound } from '../lib/http';
import { isValidIsoDate } from '../lib/validate';
import { writeMasterAuditSql } from '../masters/audit';
import { layoutOfEmployeeType } from '../employees/references';
import { loadPerson, quotaTypes } from './proRata';
import { PRO_RATA_LAYOUTS, clearanceFor, cycleYearFor, leaveYearRange, spanLabel } from './proRataRules';
import { balanceOf, loadPolicy, rows } from './requests';

/**
 * No Dues — leave clearance of a fixed-term employee (Contract, Project staff, PhD scholar, Intern) who is leaving.
 *
 * Their leave was credited pro-rata up to "Valid up to" (proRata.ts). Leaving earlier, on the relieving date, the
 * months after it were not worked: for every leave year from joining to the relieving date and every leave type of
 * their leave group, entitled = balance (with carried-forward days) − the pro-rata days of the months not worked.
 * Approved leave beyond that is excess, to be recovered from salary. Leave records are not changed; issuing the
 * clearance is written to the audit log. Administrator only.
 */
export interface ClearanceRow {
  cycleYear: number; cycle: string; workedPeriod: string; code: string; name: string; yearlyQuota: number;
  credited: number; notWorkedDays: number; entitled: number; used: number; pending: number; excess: number;
}
export interface Clearance {
  employee: { id: string; biometricId: string; name: string; designation: string; department: string; employmentType: string; joiningDate: string | null; validUpto: string | null };
  relievingDate: string;
  rows: ClearanceRow[];
  totalExcess: number;
  pendingRequests: number;
  leaveAfterRelieving: Array<{ code: string; from: string; to: string; days: number }>;
  warnings: string[];
}

export const NO_DUES_AUDIT_KEY = 'leave_no_dues';

export async function leaveClearance(userIdRaw: unknown, relievingRaw: unknown): Promise<Clearance> {
  const userId = Number(userIdRaw);
  if (!Number.isInteger(userId) || userId <= 0) throw badRequest('Choose an employee.');
  const relievingDate = String(relievingRaw ?? '').trim();
  if (!isValidIsoDate(relievingDate)) throw badRequest('Enter the relieving date.', { relievingDate: 'Enter the relieving date.' });

  const p = await loadPerson(pool, userId);
  if (!p) throw notFound('Employee not found.');
  const [info] = await rows(pool,
    `SELECT u.is_system, p.designation, p.department, et.name AS type_name FROM users u
       LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
       LEFT JOIN employee_types et ON et.code = p.employment_type WHERE u.id = ? LIMIT 1`, [userId]);
  if (Number(info?.is_system) === 1) throw badRequest('System accounts have no leave clearance.');
  const layout = await layoutOfEmployeeType(pool, p.employmentType);
  if (!layout || !PRO_RATA_LAYOUTS.has(layout)) {
    throw badRequest('Leave clearance (No Dues) is for Contract, Project staff, PhD scholars and Interns, whose leave is credited pro-rata.');
  }
  if (p.joining && relievingDate < p.joining) throw badRequest('The relieving date is before the joining date.', { relievingDate: 'The relieving date is before the joining date.' });

  const warnings: string[] = [];
  if (p.validUpto && relievingDate > p.validUpto) warnings.push(`The relieving date is after "Valid up to" (${p.validUpto}).`);
  const types = await quotaTypes(pool, p);
  if (!types.length) warnings.push('The employee\'s leave group has no leave type with a quota for their employee type.');

  const joining = p.joining || relievingDate;
  const firstYear = cycleYearFor(joining, p.basis);
  const lastYear = cycleYearFor(relievingDate, p.basis);
  const out: ClearanceRow[] = [];
  for (let cycleYear = firstYear; cycleYear <= lastYear; cycleYear++) {
    const year = leaveYearRange(cycleYear, p.basis);
    const workedSpan = { from: joining, to: relievingDate };
    const creditedSpan = { from: joining, to: p.validUpto && p.validUpto > relievingDate ? p.validUpto : relievingDate };
    const cycle = p.basis === 'FY' ? `FY ${cycleYear}-${String((cycleYear + 1) % 100).padStart(2, '0')}` : `CY ${cycleYear}`;
    for (const t of types) {
      const policy = await loadPolicy(pool, t.id);
      if (!policy) continue;
      const bal = await balanceOf(pool, userId, policy, cycleYear);
      const credited = bal.total + bal.carryForward;
      if (credited <= 0 && bal.used <= 0) continue;
      const c = clearanceFor({ quota: t.quota, credited, used: bal.used, creditedSpan, workedSpan, year });
      out.push({
        cycleYear, cycle, workedPeriod: spanLabel(workedSpan, year), code: t.code, name: policy.name, yearlyQuota: t.quota,
        credited, notWorkedDays: c.notWorkedDays, entitled: c.entitled, used: bal.used, pending: bal.pending, excess: c.excess,
      });
    }
  }

  const [pending] = await rows(pool,
    "SELECT COUNT(*) AS n FROM leave_requests WHERE user_id = ? AND status IN ('pending_l1', 'pending_l2')", [userId]);
  if (Number(pending?.n) > 0) warnings.push(`${Number(pending.n)} leave request(s) are still pending: decide them before issuing the clearance.`);
  const later = await rows(pool,
    `SELECT t.code, DATE_FORMAT(r.start_date, '%Y-%m-%d') AS f, DATE_FORMAT(r.end_date, '%Y-%m-%d') AS e, r.days_count
       FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
      WHERE r.user_id = ? AND r.status = 'approved' AND r.end_date > ? ORDER BY r.start_date`, [userId, relievingDate]);
  if (later.length) warnings.push('Approved leave runs past the relieving date (counted as used above).');

  return {
    employee: {
      id: String(p.id), biometricId: p.biometricId, name: p.name, designation: String(info?.designation ?? ''), department: String(info?.department ?? ''),
      employmentType: String(info?.type_name ?? p.employmentType), joiningDate: p.joining, validUpto: p.validUpto,
    },
    relievingDate,
    rows: out,
    totalExcess: Math.round(out.reduce((s, r) => s + r.excess, 0) * 2) / 2,
    pendingRequests: Number(pending?.n ?? 0),
    leaveAfterRelieving: later.map((r) => ({ code: String(r.code), from: String(r.f), to: String(r.e), days: Number(r.days_count) })),
    warnings,
  };
}

/** Records that the clearance was issued (audit log, with the figures) and returns it with the moment of issue. */
export async function issueLeaveClearance(req: Request, userIdRaw: unknown, relievingRaw: unknown): Promise<Clearance & { issuedAt: string }> {
  const c = await leaveClearance(userIdRaw, relievingRaw);
  if (c.pendingRequests > 0) throw badRequest(`${c.pendingRequests} leave request(s) are still pending: decide them before issuing the clearance.`);
  await writeMasterAuditSql(pool, req, {
    masterKey: NO_DUES_AUDIT_KEY, recordId: c.employee.biometricId, recordLabel: `${c.employee.name} (${c.employee.biometricId})`, action: 'CREATE',
    after: {
      relievingDate: c.relievingDate, totalExcessDays: c.totalExcess,
      byType: c.rows.map((r) => `${r.cycle} ${r.code}: entitled ${r.entitled}, used ${r.used}, excess ${r.excess}`).join('; '),
    },
    reason: c.totalExcess > 0 ? `Leave clearance: ${c.totalExcess} day(s) of excess leave to be recovered` : 'Leave clearance: no excess leave',
  });
  return { ...c, issuedAt: new Date().toISOString() };
}

