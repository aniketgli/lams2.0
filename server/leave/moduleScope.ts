import type { Request } from 'express';
import { pool } from '../../src/db';
import { forbidden, badRequest } from '../lib/http';
import { employeeTypeModules } from '../employees/references';
import { listLeaveTypes } from './types';
import { listLeaveGroups } from './groups';

/**
 * HRMS and PMS share the leave types and leave groups. In PMS its Administrator keeps only the PMS ones:
 *   a leave type is PMS's when it is for PMS employee types only (an empty list means every type: shared);
 *   a leave group is PMS's when every leave type in it is PMS's.
 * Shared and HRMS ones are kept in HRMS. In HRMS nothing changes (its Administrator keeps everything).
 * PMS screens list: the master screens (?scope=master) only PMS's; the employee form PMS's and shared ones.
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

/** PMS: a new or edited leave type must be for PMS employee types only; an existing one must already be PMS's. */
export async function assertPmsLeaveType(req: Request, id: number | null, body: unknown): Promise<void> {
  if (!inPms(req)) return;
  const modules = await employeeTypeModules(pool);
  if (id !== null && (await leaveTypeOwners()).get(String(id)) !== 'PMS') throw forbidden('This leave type is not a PMS one: it is kept in HRMS.');
  if (body !== undefined) {
    const types = (body as { employeeTypes?: unknown } | null)?.employeeTypes;
    const list = Array.isArray(types) ? types.map(String) : [];
    if (ownerOfTypes(list, modules) !== 'PMS') {
      throw badRequest('Please correct the highlighted fields.', { employeeTypes: 'Choose the PMS employee types this leave is for (Contractual, Project staff …).' });
    }
  }
}

/** PMS: a leave group may hold PMS leave types only; an existing one must already be PMS's. */
export async function assertPmsLeaveGroup(req: Request, id: number | null, body: unknown): Promise<void> {
  if (!inPms(req)) return;
  const owners = await leaveTypeOwners();
  if (id !== null) {
    const group = (await listLeaveGroups()).groups.find((g) => g.id === String(id));
    if (group && ownerOfGroup(group.leaveTypeIds, owners) !== 'PMS') throw forbidden('This leave group is not a PMS one: it is kept in HRMS.');
  }
  if (body !== undefined) {
    const ids = (body as { leaveTypeIds?: unknown } | null)?.leaveTypeIds;
    const list = Array.isArray(ids) ? ids.map(String) : [];
    if (list.some((t) => owners.get(t) !== 'PMS')) {
      throw badRequest('Please correct the highlighted fields.', { leaveTypeIds: 'A PMS leave group holds PMS leave types only.' });
    }
  }
}
