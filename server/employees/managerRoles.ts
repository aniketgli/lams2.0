import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { findRole, loadCatalog } from '../lib/roleCatalog';
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
/** Whose employees: HRMS (Permanent, Trainee) or PMS (the project / contract types), by the employee's type. */
export type PeopleModule = 'HRMS' | 'PMS';

/**
 * PMS has one approver, the PI: a PMS employee's "reporting manager" is an account holding the PMS role
 * "Principal Investigator (PI)" (role id pms_pi, which acts as the reporting manager in PMS). PMS has no HoD.
 */
const PMS_PI_ROLE = 'pms_pi';

async function managerRolesOf(q: Q, module: PeopleModule, where: string, params: unknown[]): Promise<Array<{ biometricId: string; kind: ManagerKind }>> {
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT g.biometric_id, g.module_id, g.role_id FROM user_module_roles g JOIN users u ON u.biometric_id = g.biometric_id
      WHERE LOWER(g.status) = 'active' AND LOWER(u.status) = 'active' AND ${where}`, params);
  const catalog = await loadCatalog();
  const out: Array<{ biometricId: string; kind: ManagerKind }> = [];
  for (const r of rows) {
    const entry = findRole(catalog, r.module_id, r.role_id);
    if (!entry) continue;
    if (module === 'HRMS' && entry.moduleId === 'hrms') {
      if (entry.accessRole === MANAGER_ROLE.reporting) out.push({ biometricId: String(r.biometric_id), kind: 'reporting' });
      if (entry.accessRole === MANAGER_ROLE.hod) out.push({ biometricId: String(r.biometric_id), kind: 'hod' });
    }
    if (module === 'PMS' && entry.moduleId === 'pms' && entry.roleId === PMS_PI_ROLE) out.push({ biometricId: String(r.biometric_id), kind: 'reporting' });
  }
  return out;
}

/** Whether the account holds the manager role of `kind` (HRMS: Reporting Manager / HoD; PMS: PI). */
export async function holdsManagerRole(q: Q, biometricId: string, kind: ManagerKind, module: PeopleModule = 'HRMS'): Promise<boolean> {
  const roles = await managerRolesOf(q, module, 'g.biometric_id = ?', [biometricId]);
  return roles.some((r) => r.kind === kind);
}

/** Whether any active employee (not a system account) holds the manager role of `kind`. */
export async function someoneHoldsManagerRole(q: Q, kind: ManagerKind, module: PeopleModule = 'HRMS'): Promise<boolean> {
  const roles = await managerRolesOf(q, module, 'u.is_system = 0', []);
  return roles.some((r) => r.kind === kind);
}

export const managerRoleMessage = (kind: ManagerKind, module: PeopleModule = 'HRMS'): string =>
  module === 'PMS'
    ? 'Choose an employee who has the PI role in PMS (User Controls → roles, PMS column).'
    : kind === 'reporting'
      ? 'Choose an employee who has the Reporting Manager role (User Controls → roles).'
      : 'Choose an employee who has the HoD role (User Controls → roles).';
