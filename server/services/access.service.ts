import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { employee_profiles, user_module_roles, users } from '../../src/db/schema';
import { ModuleId, RoleId, normalizeModule, normalizeRole } from '../lib/roles';
import { todayInIndia } from '../lib/validate';

export interface AccountRow {
  id: number;
  biometricId: string;
  name: string;
  email: string;
  status: string;
  validUpto: string | null;
}

/** Canonical, de-duplicated grants: { hrms: ['general_staff', 'administrator'], ... } */
export type ModuleGrants = Partial<Record<ModuleId, RoleId[]>>;

const accountColumns = {
  id: users.id,
  biometricId: users.biometricId,
  name: users.name,
  email: users.email,
  status: users.status,
  validUpto: users.validUpto,
};

export async function findAccountById(id: number): Promise<AccountRow | null> {
  const [row] = await db.select(accountColumns).from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/**
 * Why an account may not use the portal, or null if it may.
 * An account must be `active` AND have a validity date that is today or later.
 */
export function accountBlockReason(account: Pick<AccountRow, 'status' | 'validUpto'>): string | null {
  const status = String(account.status || '').toLowerCase();
  if (status === 'expired') return 'Account validity has expired. Please contact the administrator.';
  if (status !== 'active') return 'Account is inactive. Please contact the administrator.';
  if (!account.validUpto) return 'Account validity is not configured. Please contact the administrator.';
  if (account.validUpto < todayInIndia()) return 'Account validity has expired. Please contact the administrator.';
  return null;
}

/** Only grants with status = 'active' count. Inactive (revoked) grants are ignored everywhere. */
export async function loadActiveGrants(biometricId: string): Promise<ModuleGrants> {
  const rows = await db
    .select({ moduleId: user_module_roles.moduleId, roleId: user_module_roles.roleId, status: user_module_roles.status })
    .from(user_module_roles)
    .where(and(eq(user_module_roles.biometricId, biometricId), eq(user_module_roles.status, 'active')));

  const grants: ModuleGrants = {};
  for (const row of rows) {
    const moduleId = normalizeModule(row.moduleId);
    if (!moduleId) continue; // unknown module IDs grant nothing
    // The module is listed even if its role names are module-specific (e.g. future
    // PMS roles) so it still appears in the lobby; only recognised roles can be activated.
    const list = (grants[moduleId] ||= []);
    const roleId = normalizeRole(row.roleId);
    if (roleId && !list.includes(roleId)) list.push(roleId);
  }
  return grants;
}

export function hasGrant(grants: ModuleGrants, moduleId: ModuleId, roleId: RoleId): boolean {
  return Boolean(grants[moduleId]?.includes(roleId));
}

// ---------------------------------------------------------------------------
// Salutation shown before the user's name (from employee_profiles.suffix).
// ---------------------------------------------------------------------------

const SALUTATIONS: Record<string, string> = {
  mr: 'Mr.', mrs: 'Mrs.', ms: 'Ms.', miss: 'Miss', dr: 'Dr.', prof: 'Prof.',
};

/** Canonical salutation for a stored value, or null if empty/unrecognised. */
export function normalizeSalutation(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase().replace(/\.$/, '');
  return SALUTATIONS[key] ?? null;
}

let warnedMissingSuffixColumn = false;

/** The salutation saved on the user's profile, or null when none is saved. */
export async function loadSalutation(biometricId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ suffix: employee_profiles.suffix })
      .from(employee_profiles)
      .where(eq(employee_profiles.biometricId, biometricId))
      .limit(1);
    return normalizeSalutation(row?.suffix);
  } catch (error) {
    // Until migrations/20261029_employee_profile_salutation.sql is run the
    // column does not exist; show names without a salutation instead of failing.
    const code = (error as { code?: string; cause?: { code?: string } })?.code
      ?? (error as { cause?: { code?: string } })?.cause?.code;
    if (code === 'ER_BAD_FIELD_ERROR') {
      if (!warnedMissingSuffixColumn) {
        warnedMissingSuffixColumn = true;
        console.warn('[profile] employee_profiles.suffix is missing; run migrations/20261029_employee_profile_salutation.sql');
      }
      return null;
    }
    throw error;
  }
}
