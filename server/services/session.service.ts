import type { Request } from 'express';
import { MODULE_IDS, ModuleId, RoleId } from '../lib/roles';
import { sessionConfig } from '../config/session.config';
import { loadSalutation } from './access.service';

export interface SessionPayload {
  /** salutation: Mr./Mrs./Ms./Miss/Dr./Prof. from the employee profile, or null if none saved. */
  user: { id: string; biometricId: string; name: string; email: string; salutation: string | null };
  /** True until the user replaces the default / temporary password. The server blocks everything else meanwhile. */
  mustChangePassword: boolean;
  modules: { moduleId: ModuleId; roles: RoleId[] }[];
  activeModule: ModuleId | null;
  activeRole: RoleId | null;
  /** Limits the browser mirrors to warn before sign-out. The server enforces them regardless. */
  limits: { idleSeconds: number; expiresAt: string };
}

/**
 * The one shape the client receives for "who am I and what can I do".
 * Returned by login, /auth/me, and every module/role change, so the client
 * never has to piece session state together from several calls.
 */
export async function buildSessionPayload(req: Request): Promise<SessionPayload> {
  const auth = req.auth!;
  return {
    user: {
      id: String(auth.account.id),
      biometricId: auth.account.biometricId,
      name: auth.account.name,
      email: auth.account.email,
      salutation: await loadSalutation(auth.account.biometricId),
    },
    mustChangePassword: Boolean(auth.account.mustChangePassword),
    modules: MODULE_IDS
      .filter((moduleId) => auth.grants[moduleId] !== undefined)
      .map((moduleId) => ({ moduleId, roles: [...(auth.grants[moduleId] ?? [])] })),
    activeModule: auth.activeModule,
    activeRole: auth.activeRole,
    limits: {
      idleSeconds: Math.round(sessionConfig.idleMs / 1000),
      expiresAt: new Date(Number(req.session.loginAt) + sessionConfig.maxMs).toISOString(),
    },
  };
}
