import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    role?: string;
    activeModule?: string | null;
    activeRole?: string | null;
}
}
