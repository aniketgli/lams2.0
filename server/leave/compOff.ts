import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { workedOffDays } from '../attendance/store';
import { type Credit, creditValidUntil, shift } from './compOffRules';

export { COMP_OFF_CODE, RESTRICTED_CODE, balanceFromCredits, creditValidUntil, matchCredits, monthlyProblem } from './compOffRules';
export type { Credit } from './compOffRules';

/**
 * Compensatory off. Each weekly off / gazetted holiday on which the biometric machines recorded both an In and an Out punch
 * earns one day. The day can be taken until its validity ends (one month after the work day, counted as in the policy example:
 * work on 8 Nov → usable up to 9 Dec). Approved manual attendance never earns one. The limit of days per month is the leave
 * type's own "times a month" rule (Master Settings → Leave types).
 */

export interface CreditPerson { userId: number; biometricId: string; shiftId: string | null; joining: string | null }

/** Earn dates that can still be valid today: nothing older than about a month and two days is read. */
const lookBack = (today: string) => {
  const [y, m, d] = today.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 2, d));
  return shift(prev.toISOString().slice(0, 10), -3);
};

/** Credits still valid on `today` for each person (used ones included, marked), by user id. */
export async function creditsFor(people: CreditPerson[], today: string, exceptRequestId = 0): Promise<Map<number, Credit[]>> {
  const out = new Map<number, Credit[]>();
  if (people.length === 0) return out;
  const worked = await workedOffDays(people, lookBack(today), today);
  const [uses] = await pool.query<RowDataPacket[]>(
    `SELECT c.request_id AS id, c.user_id, DATE_FORMAT(c.work_date, '%Y-%m-%d') AS d, r.status FROM leave_comp_off_uses c
       JOIN leave_requests r ON r.id = c.request_id
      WHERE r.status <> 'rejected' AND c.request_id <> ? AND c.user_id IN (${people.map(() => '?').join(',')})`,
    [exceptRequestId, ...people.map((p) => p.userId)],
  );
  const usedOf = new Map(uses.map((u) => [`${u.user_id}:${u.d}`, u]));
  for (const p of people) {
    const list: Credit[] = [];
    for (const w of worked.get(p.biometricId) ?? []) {
      const validUntil = creditValidUntil(w.date);
      if (validUntil < today) continue;
      const use = usedOf.get(`${p.userId}:${w.date}`);
      list.push({ ...w, validUntil, usedBy: use ? Number(use.id) : null, usedStatus: use ? (String(use.status) === 'approved' ? 'approved' : 'pending') : null });
    }
    out.set(p.userId, list.sort((a, b) => a.date.localeCompare(b.date)));
  }
  return out;
}

export async function personById(userId: number): Promise<CreditPerson | null> {
  const [found] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.biometric_id, p.shift_id, DATE_FORMAT(p.joining_date, '%Y-%m-%d') AS joining FROM users u
       LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id WHERE u.id = ? LIMIT 1`, [userId]);
  const r = found[0];
  return r ? { userId: Number(r.id), biometricId: String(r.biometric_id), shiftId: r.shift_id ? String(r.shift_id) : null, joining: r.joining ? String(r.joining) : null } : null;
}


/** Compensatory off days already taken or waiting, by month of the leave day (the leave being edited is left out). */
export async function takenByMonth(userId: number, exceptRequestId: number): Promise<Record<string, number>> {
  const [found] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(c.leave_date, '%Y-%m') AS m, COUNT(*) AS n FROM leave_comp_off_uses c JOIN leave_requests r ON r.id = c.request_id
      WHERE c.user_id = ? AND r.status <> 'rejected' AND c.request_id <> ? GROUP BY m`, [userId, exceptRequestId]);
  return Object.fromEntries(found.map((r) => [String(r.m), Number(r.n)]));
}
