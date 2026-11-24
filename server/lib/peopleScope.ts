import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../src/db';
import { type PeopleModule, peopleModuleOf, peopleRoleOf } from './hrmsViewer';
import type { RoleId } from './roles';

/**
 * HRMS and PMS share the attendance, leave, outdoor duty, manual attendance and dashboard screens. Each module shows
 * only its own employees: HRMS the Permanent and Trainee employees, PMS the project / contract ones (the employee
 * type's module, Master Settings → Employee Types). An employee without a type counts as HRMS.
 *
 * The scope is the set of user ids of the module's employees; the stores keep a row only when its user is in it
 * (inScope), whatever the role: an administrator sees all of its module, a manager their team within it, a user
 * their own records when they belong to it.
 */
export async function peopleScope(module: PeopleModule): Promise<Set<string>> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id FROM users u
         LEFT JOIN employee_profiles p ON p.biometric_id = u.biometric_id
         LEFT JOIN employee_types et ON et.code = p.employment_type
        WHERE COALESCE(UPPER(et.module), 'HRMS') = ?`, [module]);
    return new Set(rows.map((r) => String(r.id)));
  } catch (error) {
    // Before migrations/20261225_hrms_pms_split.sql everyone is HRMS.
    if ((error as { code?: string })?.code !== 'ER_BAD_FIELD_ERROR') throw error;
    if (module === 'PMS') return new Set();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM users');
    return new Set(rows.map((r) => String(r.id)));
  }
}

export interface ScopedViewer { id: number; role: RoleId | null; module: PeopleModule | null; scope?: ReadonlySet<string> }

/** The signed-in account, its role in HRMS or PMS, and the user ids of that module's employees. */
export async function scopedViewerOf(req: Pick<Request, 'auth'>): Promise<ScopedViewer> {
  const module = peopleModuleOf(req);
  const viewer: ScopedViewer = { id: req.auth!.account.id, role: peopleRoleOf(req), module };
  if (module) viewer.scope = await peopleScope(module);
  return viewer;
}

/** Whether a user's records belong to the viewer's module (always true when the viewer has no scope). */
export const inScope = (viewer: { scope?: ReadonlySet<string> }, userId: unknown): boolean =>
  !viewer.scope || viewer.scope.has(String(userId));
