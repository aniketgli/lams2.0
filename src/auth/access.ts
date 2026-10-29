import type { EnterpriseModuleId, UserRole } from '../types';

/**
 * Module and role vocabulary shared by the client. Mirrors server/lib/roles.ts.
 * The server uses canonical module IDs; older UI code still uses legacy ones.
 */

export type ServerModuleId = 'hrms' | 'pms' | 'stock' | 'facility' | 'finance';

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrator',
  audit: 'Auditor',
  reviewing_manager: 'HoD',
  reporting_manager: 'Reporting Manager',
  general_staff: 'User',
};

/** Order roles appear in the role switcher. */
export const ROLE_ORDER: UserRole[] = ['general_staff', 'reporting_manager', 'reviewing_manager', 'audit', 'administrator'];

const SERVER_TO_UI: Record<ServerModuleId, EnterpriseModuleId> = {
  hrms: 'lams',
  pms: 'pms',
  stock: 'sims',
  facility: 'fms',
  finance: 'finance',
};

const UI_TO_SERVER: Record<EnterpriseModuleId, ServerModuleId> = {
  lams: 'hrms',
  pms: 'pms',
  sims: 'stock',
  fms: 'facility',
  finance: 'finance',
};

export const toUiModule = (id: ServerModuleId): EnterpriseModuleId => SERVER_TO_UI[id];
export const toServerModule = (id: EnterpriseModuleId): ServerModuleId => UI_TO_SERVER[id];

export interface SessionPayload {
  /** salutation is Mr./Mrs./Ms./Miss/Dr./Prof. from the employee profile, or null. */
  user: { id: string; biometricId: string; name: string; email: string; salutation: string | null };
  modules: { moduleId: ServerModuleId; roles: UserRole[] }[];
  activeModule: ServerModuleId | null;
  activeRole: UserRole | null;
  /** Session limits from the server; the browser only uses them to warn in time. */
  limits: { idleSeconds: number; expiresAt: string };
}
