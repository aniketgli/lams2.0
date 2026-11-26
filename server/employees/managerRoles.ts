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
/** Whose employees: HRMS (Permanent, Trainee) or PMS (the project / contract types), by the employee's type; same rules. */
export type PeopleModule = 'HRMS' | 'PMS';

async function managerRolesOf(q: Q, module: PeopleModule, where: string, params: unknown[]): Promise<Array<{ biometricId: string; kind: ManagerKind }>> {
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT g.biometric_id, g.module_id, g.role_id FROM user_module_roles g JOIN users u ON u.biometric_id = g.biometric_id
      WHERE LOWER(g.status) = 'active' AND LOWER(u.status) = 'active' AND ${where}`, params);
  const catalog = await loadCatalog();
  const out: Array<{ biometricId: string; kind: ManagerKind }> = [];
  for (const r of rows) {
    const entry = findRole(catalog, r.module_id, r.role_id);
    if (!entry) continue;
    // The same rule in both modules: the Reporting Manager / HoD role of the employee's module.
    if (entry.moduleId !== (module === 'PMS' ? 'pms' : 'hrms')) continue;
    if (entry.accessRole === MANAGER_ROLE.reporting) out.push({ biometricId: String(r.biometric_id), kind: 'reporting' });
    if (entry.accessRole === MANAGER_ROLE.hod) out.push({ biometricId: String(r.biometric_id), kind: 'hod' });
  }
  return out;
}

/** Whether the account holds the manager role of `kind` (Reporting Manager / HoD) in the employee's module. */
export async function holdsManagerRole(q: Q, biometricId: string, kind: ManagerKind, module: PeopleModule = 'HRMS'): Promise<boolean> {
  const roles = await managerRolesOf(q, module, 'g.biometric_id = ?', [biometricId]);
  return roles.some((r) => r.kind === kind);
}

/** Whether any active employee (not a system account) holds the manager role of `kind`. */
export async function someoneHoldsManagerRole(q: Q, kind: ManagerKind, module: PeopleModule = 'HRMS'): Promise<boolean> {
  const roles = await managerRolesOf(q, module, 'u.is_system = 0', []);
  return roles.some((r) => r.kind === kind);
}

/** The active employees (not system accounts) holding the manager role of `kind` in `module`, by biometric ID. */
export async function managerRoleHolders(q: Q, kind: ManagerKind, module: PeopleModule = 'HRMS'): Promise<Set<string>> {
  const roles = await managerRolesOf(q, module, 'u.is_system = 0', []);
  return new Set(roles.filter((r) => r.kind === kind).map((r) => r.biometricId));
}

export const managerRoleMessage = (kind: ManagerKind, module: PeopleModule = 'HRMS'): string => {
  const where = module === 'PMS' ? ' in PMS (User Controls → roles, PMS column)' : ' (User Controls → roles)';
  return kind === 'reporting'
    ? `Choose an employee who has the Reporting Manager role${where}.`
    : `Choose an employee who has the HoD role${where}.`;
};

/**
 * The active employees (not system accounts) holding a role with this access in a module, by biometric ID: e.g.
 * the PMS PIs (project_pi), who can be chosen as the PI of a project.
 */
export async function accessRoleHolders(q: Q, module: PeopleModule, accessRole: RoleId): Promise<Set<string>> {
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT g.biometric_id, g.module_id, g.role_id FROM user_module_roles g JOIN users u ON u.biometric_id = g.biometric_id
      WHERE LOWER(g.status) = 'active' AND LOWER(u.status) = 'active' AND u.is_system = 0`);
  const catalog = await loadCatalog();
  const out = new Set<string>();
  for (const r of rows) {
    const entry = findRole(catalog, r.module_id, r.role_id);
    if (entry && entry.moduleId === (module === 'PMS' ? 'pms' : 'hrms') && entry.accessRole === accessRole) out.add(String(r.biometric_id));
  }
  return out;
}
