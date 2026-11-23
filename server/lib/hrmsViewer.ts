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

/**
 * HRMS and PMS share the employee, attendance and leave screens (the /api/hrms routes): HRMS for the Permanent and
 * Trainee employees, PMS for the project / contract types (employee_types.module). A route opened to both reads the
 * caller's role and module through these; a route that stays HRMS-only keeps using hrmsRoleOf.
 */
export type PeopleModule = 'HRMS' | 'PMS';
export function peopleModuleOf(req: Pick<Request, 'auth'>): PeopleModule | null {
  const module = req.auth?.activeModule;
  return module === 'hrms' ? 'HRMS' : module === 'pms' ? 'PMS' : null;
}
export function peopleRoleOf(req: Pick<Request, 'auth'>): RoleId | null {
  return peopleModuleOf(req) ? req.auth?.activeRole ?? null : null;
}
/** The signed-in account, its role and the module it works in (HRMS or PMS). */
export const peopleViewerOf = (req: Pick<Request, 'auth'>): { id: number; role: RoleId | null; module: PeopleModule | null } =>
  ({ id: req.auth!.account.id, role: peopleRoleOf(req), module: peopleModuleOf(req) });
