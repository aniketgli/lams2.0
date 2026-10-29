import 'express-session';
import type { AccountRow, ModuleGrants } from '../services/access.service';
import type { ModuleId, RoleId } from '../lib/roles';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    biometricId: string;
    activeModule?: ModuleId | null;
    activeRole?: RoleId | null;
    /** Mirror of activeRole for legacy route code that still reads it. */
    role?: RoleId;
  }
}

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth for every authenticated request. */
      auth?: {
        account: AccountRow;
        grants: ModuleGrants;
        activeModule: ModuleId | null;
        activeRole: RoleId | null;
      };
    }
  }
}

export {};
