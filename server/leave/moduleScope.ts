import type { Request } from 'express';
import { pool } from '../../src/db';
import { forbidden } from '../lib/http';
import { employeeTypeModules } from '../employees/references';
import { listLeaveTypes } from './types';
import { listLeaveGroups } from './groups';

/**
 * HRMS and PMS share the leave types and leave groups. They are all kept in HRMS (its Master Settings, also the
 * ones for PMS employee types) and apply to PMS from there; PMS has no leave masters and changes none.
 *   a leave type is PMS's when it is for PMS employee types only (an empty list means every type: shared);
 *   a leave group is PMS's when every leave type in it is PMS's.
 * PMS screens list PMS's and shared ones (the employee form, leave balances); ?scope=master only PMS's.
 */
export type Owner = 'HRMS' | 'PMS' | 'shared';

export const inPms = (req: Pick<Request, 'auth'>): boolean => req.auth?.activeModule === 'pms';

export function ownerOfTypes(employeeTypes: readonly string[], modules: Map<string, 'HRMS' | 'PMS'>): Owner {
  if (!employeeTypes.length) return 'shared';
  const owners = new Set(employeeTypes.map((c) => modules.get(c) ?? 'HRMS'));
  return owners.size === 1 ? [...owners][0] : 'shared';
}

export async function leaveTypeOwners(): Promise<Map<string, Owner>> {
  const modules = await employeeTypeModules(pool);
  return new Map((await listLeaveTypes()).map((t) => [t.id, ownerOfTypes(t.employeeTypes, modules)]));
}

export function ownerOfGroup(typeIds: readonly string[], typeOwners: Map<string, Owner>): Owner {
  if (!typeIds.length) return 'shared';
  const owners = new Set(typeIds.map((id) => typeOwners.get(id) ?? 'shared'));
  return owners.size === 1 ? [...owners][0] : 'shared';
}

export const LEAVE_MASTERS_IN_HRMS = 'Leave types and leave groups are kept in HRMS (Master Settings) and apply to PMS from there.';

/** PMS keeps no leave masters: leave types and groups (also those for PMS employee types) are changed in HRMS only. */
export async function assertPmsLeaveType(req: Request, _id: number | null, _body: unknown): Promise<void> {
  if (inPms(req)) throw forbidden(LEAVE_MASTERS_IN_HRMS);
}

/** PMS keeps no leave masters: see assertPmsLeaveType. */
export async function assertPmsLeaveGroup(req: Request, _id: number | null, _body: unknown): Promise<void> {
  if (inPms(req)) throw forbidden(LEAVE_MASTERS_IN_HRMS);
}
