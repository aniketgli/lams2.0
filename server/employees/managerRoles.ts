import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { loadCatalog, resolveGrant } from '../lib/roleCatalog';
import type { RoleId } from '../lib/roles';

/**
 * Who may be chosen as a reporting manager or HoD: only an account holding that HRMS role
 * (Reporting Manager / HoD) as an active grant. Checked on the server for the employee form, the bulk import
 * and the transfer / manager-change orders; the form only offers the same people.
 *
 * The Administrator (system account) stays allowed while no employee holds the role yet, so the first employees can
 * still be registered.
 */
export const MANAGER_ROLE = { reporting: 'reporting_manager', hod: 'reviewing_manager' } as const satisfies Record<string, RoleId>;
export type ManagerKind = keyof typeof MANAGER_ROLE;

type Q = Pick<PoolConnection, 'query'>;

async function hrmsRolesOf(q: Q, where: string, params: unknown[]): Promise<Array<{ biometricId: string; role: RoleId }>> {
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT g.biometric_id, g.module_id, g.role_id FROM user_module_roles g JOIN users u ON u.biometric_id = g.biometric_id
      WHERE LOWER(g.status) = 'active' AND LOWER(u.status) = 'active' AND ${where}`, params);
  const catalog = await loadCatalog();
  const out: Array<{ biometricId: string; role: RoleId }> = [];
  for (const r of rows) {
    const grant = resolveGrant(catalog, r.module_id, r.role_id);
    if (grant?.moduleId === 'hrms') out.push({ biometricId: String(r.biometric_id), role: grant.role });
  }
  return out;
}

/** Whether the account holds the manager role of `kind`. */
export async function holdsManagerRole(q: Q, biometricId: string, kind: ManagerKind): Promise<boolean> {
  const roles = await hrmsRolesOf(q, 'g.biometric_id = ?', [biometricId]);
  return roles.some((r) => r.role === MANAGER_ROLE[kind]);
}

/** Whether any active employee (not a system account) holds the manager role of `kind`. */
export async function someoneHoldsManagerRole(q: Q, kind: ManagerKind): Promise<boolean> {
  const roles = await hrmsRolesOf(q, 'u.is_system = 0', []);
  return roles.some((r) => r.role === MANAGER_ROLE[kind]);
}

export const managerRoleMessage = (kind: ManagerKind): string =>
  kind === 'reporting'
    ? 'Choose an employee who has the Reporting Manager role (User Controls → roles).'
    : 'Choose an employee who has the HoD role (User Controls → roles).';
