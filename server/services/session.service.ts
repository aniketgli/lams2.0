import type { Request } from 'express';
import { MODULE_IDS, ModuleId, RoleId } from '../lib/roles';
import { sessionConfig } from '../config/session.config';

export interface SessionPayload {
  user: { id: string; biometricId: string; name: string; email: string };
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
    limits: {
      idleSeconds: Math.round(sessionConfig.idleMs / 1000),
      expiresAt: new Date(Number(req.session.loginAt) + sessionConfig.maxMs).toISOString(),
    },
  };
}
