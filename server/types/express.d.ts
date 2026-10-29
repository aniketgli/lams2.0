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
    /** Epoch ms of sign-in; the session ends sessionConfig.maxMs after this. */
    loginAt: number;
    /** Epoch ms of the last user-initiated request; idle timeout counts from here. */
    lastActivityAt: number;
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
