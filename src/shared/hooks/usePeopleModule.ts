import { useSession } from '../../auth/SessionContext';

/**
 * HRMS and PMS share the attendance, leave, holiday and employee screens; this says which one is on screen.
 * In PMS the holidays, leave types and activity logs stay read-only / with HRMS (their routes are HRMS's).
 */
export function usePeopleModule(): 'HRMS' | 'PMS' {
  const { session } = useSession();
  return session?.activeModule === 'pms' ? 'PMS' : 'HRMS';
}
