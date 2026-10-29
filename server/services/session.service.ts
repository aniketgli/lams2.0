import type { Request } from 'express';
import { MODULE_IDS, ModuleId, RoleId } from '../lib/roles';

export interface SessionPayload {
  user: { id: string; biometricId: string; name: string; email: string };
  modules: { moduleId: ModuleId; roles: RoleId[] }[];
  activeModule: ModuleId | null;
  activeRole: RoleId | null;
}

/**
 * The one shape the client receives for "who am I and what can I do".
 * Returned by login, /auth/me, and every module/role change, so the client
 * never has to piece session state together from several calls.
 */
export function buildSessionPayload(req: Request): SessionPayload {
  const auth = req.auth!;
  return {
    user: {
      id: String(auth.account.id),
      biometricId: auth.account.biometricId,
      name: auth.account.name,
      email: auth.account.email,
    },
    modules: MODULE_IDS
      .filter((moduleId) => auth.grants[moduleId] !== undefined)
      .map((moduleId) => ({ moduleId, roles: [...(auth.grants[moduleId] ?? [])] })),
    activeModule: auth.activeModule,
    activeRole: auth.activeRole,
  };
}
