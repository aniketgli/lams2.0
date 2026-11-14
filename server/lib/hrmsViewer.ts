import type { Request } from 'express';
import type { RoleId } from './roles';

/**
 * The caller's HRMS role, or null when they are not working inside HRMS.
 *
 * Role ids are shared by every module (a PMS, Stock, Facility or Finance administrator also has the access
 * role "administrator"), so an active role means something in HRMS only while HRMS is the active module.
 * HRMS routes that decide what a viewer may see or do from the role must read it through this function;
 * otherwise an administrator of another module could act as the HRMS administrator.
 */
export function hrmsRoleOf(req: Pick<Request, 'auth'>): RoleId | null {
  const auth = req.auth;
  if (!auth || auth.activeModule !== 'hrms') return null;
  return auth.activeRole ?? null;
}

/** The signed-in account and its HRMS role, as the HRMS stores expect it. */
export const hrmsViewerOf = (req: Pick<Request, 'auth'>): { id: number; role: RoleId | null } => ({ id: req.auth!.account.id, role: hrmsRoleOf(req) });
