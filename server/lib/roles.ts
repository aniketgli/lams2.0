/**
 * Single source of truth for module IDs and role names on the server.
 *
 * The database (`user_module_roles`) has historically stored roles in several
 * spellings ("hrms_admin", "Administrator", "admin", ...) and modules under
 * legacy IDs ("lams", "sims", "fms"). Everything entering the server is
 * normalised here, so the rest of the code only ever sees canonical values.
 */

export const MODULE_IDS = ['hrms', 'pms', 'stock', 'facility', 'finance'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const ROLE_IDS = ['administrator', 'audit', 'reviewing_manager', 'reporting_manager', 'general_staff'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

/** Display labels used by the UI. */
export const ROLE_LABELS: Record<RoleId, string> = {
  administrator: 'Administrator',
  audit: 'Auditor',
  reviewing_manager: 'HoD',
  reporting_manager: 'Reporting Manager',
  general_staff: 'User',
};

/**
 * Default role chosen when a user enters a module without a previous choice.
 * Lower index wins. Staff first keeps the least-privileged view as the default;
 * users switch up to a manager/admin role explicitly.
 */
const DEFAULT_ROLE_ORDER: RoleId[] = ['general_staff', 'reporting_manager', 'reviewing_manager', 'audit', 'administrator'];

const MODULE_ALIASES: Record<string, ModuleId> = {
  hrms: 'hrms', lams: 'hrms',
  pms: 'pms',
  stock: 'stock', sims: 'stock',
  facility: 'facility', fms: 'facility',
  finance: 'finance',
};

const ROLE_ALIASES: Record<string, RoleId> = {
  administrator: 'administrator', admin: 'administrator', hrmsadmin: 'administrator',
  audit: 'audit', auditor: 'audit', hrmsauditor: 'audit',
  reviewingmanager: 'reviewing_manager', hod: 'reviewing_manager', hrmsreviewing: 'reviewing_manager',
  reportingmanager: 'reporting_manager', hrmsreporting: 'reporting_manager', manager: 'reporting_manager',
  generalstaff: 'general_staff', user: 'general_staff', staff: 'general_staff', hrmsstaff: 'general_staff',
};

export function normalizeModule(value: unknown): ModuleId | null {
  if (typeof value !== 'string') return null;
  return MODULE_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function normalizeRole(value: unknown): RoleId | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return ROLE_ALIASES[key] ?? null;
}

export function pickDefaultRole(roles: RoleId[]): RoleId | null {
  for (const role of DEFAULT_ROLE_ORDER) {
    if (roles.includes(role)) return role;
  }
  return null;
}
