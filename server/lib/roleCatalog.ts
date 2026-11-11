/**
 * The role catalog: which roles exist in each module, read from the database table
 * `role_catalog` (migrations/20261203_role_catalog.sql).
 *
 *  - Giving a role: the server accepts only an active catalog role of that module, named by its
 *    id, its name or one of its aliases, and stores the catalog name (validateGrants).
 *  - Using a role: a stored grant gives access only through the active catalog row it matches,
 *    and only as that row's access_role (resolveGrant). A role switched off in the catalog
 *    (is_active = 0) stops working at once for everyone who holds it.
 *
 * Until the migration is run the built-in list below (the same rows) is used, with a warning.
 */

import { badRequest } from './http';
import { ModuleId, ROLE_IDS, RoleId, normalizeModule } from './roles';
import { TtlCache } from './ttlCache';

export interface CatalogRole {
  moduleId: ModuleId;
  roleId: string;
  name: string;
  accessRole: RoleId;
  /** Comma-separated other spellings accepted for this role. */
  aliases: string;
  description: string;
  sortOrder: number;
}

export const BUILT_IN_CATALOG: CatalogRole[] = ([
  { moduleId: 'hrms', roleId: 'administrator', name: 'Administrator', accessRole: 'administrator', aliases: 'admin,hrms_admin', description: 'Full administrative control over HR policies, shifts, biometrics, regularization and leave quotas.', sortOrder: 10 },
  { moduleId: 'hrms', roleId: 'reporting_manager', name: 'Reporting Manager', accessRole: 'reporting_manager', aliases: 'manager,hrms_reporting,rm', description: 'First-level approver for team leave, manual attendance and outdoor duty.', sortOrder: 20 },
  { moduleId: 'hrms', roleId: 'reviewing_manager', name: 'HoD', accessRole: 'reviewing_manager', aliases: 'reviewing manager,hrms_reviewing', description: 'Head of Department: second-level approval.', sortOrder: 30 },
  { moduleId: 'hrms', roleId: 'general_staff', name: 'User', accessRole: 'general_staff', aliases: 'general staff,staff,hrms_staff', description: 'Self-service attendance, leave, outdoor duty and profile.', sortOrder: 40 },
  { moduleId: 'hrms', roleId: 'leave_balance_manager', name: 'Leave Balance Manager', accessRole: 'leave_balance_manager', aliases: 'hrms_leave_balance,leave balance', description: 'Sees and sets the leave balance of every employee, and nothing else.', sortOrder: 50 },
  { moduleId: 'hrms', roleId: 'audit', name: 'Auditor', accessRole: 'audit', aliases: 'auditor,hrms_auditor', description: 'Read-only audit access to HRMS records and reports.', sortOrder: 60 },
  { moduleId: 'pms', roleId: 'pms_admin', name: 'PMS Administrator / Dean R&D', accessRole: 'administrator', aliases: 'pms admin,administrator,admin,dean r&d', description: 'Full oversight of research projects, funding agencies and grant accounts.', sortOrder: 10 },
  { moduleId: 'pms', roleId: 'pms_pi', name: 'Principal Investigator (PI)', accessRole: 'reviewing_manager', aliases: 'project pi,pi,principal investigator,hod', description: 'Lead researcher: milestones, budget and timesheet approvals.', sortOrder: 20 },
  { moduleId: 'pms', roleId: 'pms_co_pi', name: 'Co-Principal Investigator (Co-PI)', accessRole: 'reporting_manager', aliases: 'co-pi,co pi,co-principal investigator,reporting manager', description: 'Project co-lead: task allocation and interim deliverables.', sortOrder: 30 },
  { moduleId: 'pms', roleId: 'pms_researcher', name: 'Research Fellow / Staff', accessRole: 'general_staff', aliases: 'researcher,research fellow,research staff,user,staff', description: 'Timesheets, fieldwork deliverables and milestone progress.', sortOrder: 40 },
  { moduleId: 'pms', roleId: 'pms_reviewer', name: 'Project Reviewer / Auditor', accessRole: 'audit', aliases: 'project reviewer,reviewer', description: 'Technical committee member with audit and evaluation access.', sortOrder: 50 },
  { moduleId: 'pms', roleId: 'auditor', name: 'Auditor', accessRole: 'audit', aliases: 'audit', description: 'Read-only audit access to PMS records and reports.', sortOrder: 60 },
  { moduleId: 'stock', roleId: 'sims_admin', name: 'Store Administrator / Purchase Officer', accessRole: 'administrator', aliases: 'store admin,administrator,admin,purchase officer', description: 'Item catalog, procurement, inventory thresholds and disposals.', sortOrder: 10 },
  { moduleId: 'stock', roleId: 'sims_store_keeper', name: 'Store Keeper / Custodian', accessRole: 'reporting_manager', aliases: 'store keeper,custodian,reporting manager', description: 'Physical custody, goods inward, dispatch and returns.', sortOrder: 20 },
  { moduleId: 'stock', roleId: 'sims_approver', name: 'Department Indent Approver', accessRole: 'reviewing_manager', aliases: 'indent approver,approver,hod', description: 'Approves departmental indents and requisitions.', sortOrder: 30 },
  { moduleId: 'stock', roleId: 'sims_indenter', name: 'Indenter / General Staff', accessRole: 'general_staff', aliases: 'indenter,user,staff', description: 'Raises indents.', sortOrder: 40 },
  { moduleId: 'stock', roleId: 'auditor', name: 'Auditor', accessRole: 'audit', aliases: 'audit', description: 'Read-only audit access to stock records and reports.', sortOrder: 50 },
  { moduleId: 'facility', roleId: 'fms_admin', name: 'Facility & Fleet Administrator', accessRole: 'administrator', aliases: 'facility admin,administrator,admin', description: 'Facility and fleet administration.', sortOrder: 10 },
  { moduleId: 'facility', roleId: 'fms_officer', name: 'Estate / Transport Officer', accessRole: 'reviewing_manager', aliases: 'estate officer,transport officer,hod', description: 'Approves bookings and estate requests.', sortOrder: 20 },
  { moduleId: 'facility', roleId: 'fms_supervisor', name: 'Driver / Facility Supervisor', accessRole: 'reporting_manager', aliases: 'driver,facility supervisor,supervisor,reporting manager', description: 'Runs trips and facility jobs.', sortOrder: 30 },
  { moduleId: 'facility', roleId: 'fms_requester', name: 'Booking Requester / Staff', accessRole: 'general_staff', aliases: 'booking requester,requester,user,staff', description: 'Requests bookings.', sortOrder: 40 },
  { moduleId: 'facility', roleId: 'auditor', name: 'Auditor', accessRole: 'audit', aliases: 'audit', description: 'Read-only audit access to facility records and reports.', sortOrder: 50 },
  { moduleId: 'finance', roleId: 'fin_admin', name: 'Finance Comptroller / Finance Officer', accessRole: 'administrator', aliases: 'finance admin,administrator,admin,comptroller,finance officer', description: 'Finance administration.', sortOrder: 10 },
  { moduleId: 'finance', roleId: 'fin_officer', name: 'Drawing & Disbursing Officer (DDO)', accessRole: 'reviewing_manager', aliases: 'ddo,drawing and disbursing officer,hod', description: 'Approves and disburses.', sortOrder: 20 },
  { moduleId: 'finance', roleId: 'fin_accountant', name: 'Accountant / Cashier', accessRole: 'reporting_manager', aliases: 'accountant,cashier,reporting manager', description: 'Accounts and cash.', sortOrder: 30 },
  { moduleId: 'finance', roleId: 'fin_claimant', name: 'Claimant / General Staff', accessRole: 'general_staff', aliases: 'claimant,user,staff', description: 'Submits claims.', sortOrder: 40 },
  { moduleId: 'finance', roleId: 'auditor', name: 'Auditor', accessRole: 'audit', aliases: 'audit', description: 'Read-only audit access to finance records and reports.', sortOrder: 50 },
] as Array<Omit<CatalogRole, 'moduleId' | 'accessRole'> & { moduleId: string; accessRole: string }>) as CatalogRole[];

/** Spelling-insensitive key: "Co-PI", "co pi" and "co_pi" are the same. */
export const roleKey = (value: unknown): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** The active catalog role of `moduleId` that `raw` names (id, name or alias), or null. */
export function findRole(catalog: readonly CatalogRole[], moduleId: unknown, raw: unknown): CatalogRole | null {
  const module = normalizeModule(moduleId);
  const key = roleKey(raw);
  if (!module || !key) return null;
  return catalog.find((r) => r.moduleId === module && (
    roleKey(r.roleId) === key || roleKey(r.name) === key || r.aliases.split(',').some((a) => roleKey(a) === key)
  )) ?? null;
}

/** What a stored grant lets its holder do, or null when it names no active catalog role. */
export function resolveGrant(catalog: readonly CatalogRole[], moduleId: unknown, raw: unknown): { moduleId: ModuleId; role: RoleId } | null {
  const entry = findRole(catalog, moduleId, raw);
  return entry ? { moduleId: entry.moduleId, role: entry.accessRole } : null;
}

/**
 * Checks role assignments sent by an administrator against the catalog. Returns them with the
 * canonical module id and the catalog name (what is stored), without repeats; throws 400 naming
 * every role that is not in the catalog.
 */
export function validateGrants(catalog: readonly CatalogRole[], wanted: ReadonlyArray<{ moduleId: unknown; roleId: unknown }>): Array<{ moduleId: ModuleId; roleId: string }> {
  const out = new Map<string, { moduleId: ModuleId; roleId: string }>();
  const unknown: string[] = [];
  for (const item of wanted) {
    const entry = findRole(catalog, item.moduleId, item.roleId);
    if (!entry) { unknown.push(`${String(item.moduleId ?? '?')}: ${String(item.roleId ?? '').slice(0, 60)}`); continue; }
    out.set(`${entry.moduleId}::${entry.roleId}`, { moduleId: entry.moduleId, roleId: entry.name });
  }
  if (unknown.length) throw badRequest(`These roles do not exist in the role catalog: ${unknown.join(', ')}.`);
  return [...out.values()];
}

/** Catalog rows as read from the table: rows with an unknown module or access role are left out (and logged). */
export function catalogFromRows(rows: ReadonlyArray<Record<string, unknown>>): CatalogRole[] {
  const out: CatalogRole[] = [];
  for (const row of rows) {
    const moduleId = normalizeModule(row.module_id);
    const accessRole = String(row.access_role ?? '') as RoleId;
    if (!moduleId || !(ROLE_IDS as readonly string[]).includes(accessRole)) {
      console.warn(`[roles] role_catalog row ${String(row.module_id)}/${String(row.role_id)} ignored: unknown module or access_role "${accessRole}".`);
      continue;
    }
    out.push({
      moduleId, accessRole,
      roleId: String(row.role_id), name: String(row.name),
      aliases: String(row.aliases ?? ''), description: String(row.description ?? ''), sortOrder: Number(row.sort_order ?? 0),
    });
  }
  return out.sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.sortOrder - b.sortOrder);
}

// ---------------------------------------------------------------------------
// Loading (cached; another process sees a catalog change within CATALOG_CACHE_MS)
// ---------------------------------------------------------------------------

export const CATALOG_CACHE_MS = 60_000;
const cache = new TtlCache<CatalogRole[]>(CATALOG_CACHE_MS, 1);
let warnedMissing = false;

export async function loadCatalog(): Promise<CatalogRole[]> {
  return cache.getOrLoad('all', async () => {
    const { pool } = await import('../../src/db');
    try {
      const [rows] = await pool.query('SELECT module_id, role_id, name, access_role, aliases, description, sort_order FROM role_catalog WHERE is_active = 1');
      return catalogFromRows(rows as Array<Record<string, unknown>>);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'ER_NO_SUCH_TABLE') throw error;
      if (!warnedMissing) {
        warnedMissing = true;
        console.warn('[roles] table role_catalog is missing; using the built-in roles. Run migrations/20261203_role_catalog.sql');
      }
      return BUILT_IN_CATALOG;
    }
  });
}

export function clearCatalogCache(): void {
  cache.clear();
}
