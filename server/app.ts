import express from 'express';
import path from 'path';
import fs from 'fs';
import type { Server as HttpServer } from 'http';
import session from 'express-session';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../src/db';
import { emailRoutes } from './integrations/email/email.routes';
import { slackRoutes } from './integrations/slack/slack.routes';
import { authRoutes } from './routes/auth.routes';
import accessRoutes from './routes/access.routes';
import employeeRoutes from './employees/employees.routes';
import holidayRoutes from './holidays/holidays.routes';
import attendanceRoutes from './attendance/attendance.routes';
import manualAttendanceRoutes from './manualAttendance/manualAttendance.routes';
import outdoorDutyRoutes from './outdoorDuty/outdoorDuty.routes';
import mastersRoutes from './masters/masters.routes';
import settingsRoutes from './masters/settings.routes';
import { apiNotFound, errorHandler } from './middleware/errorHandler';
import { csrfGuard, noStore, securityHeaders } from './middleware/security';
import { MySqlSessionStore } from './lib/sessionStore';
import { SESSION_COOKIE } from './lib/http';
import { sessionConfig } from './config/session.config';
import { requireCurrentContext } from './middleware/auth.middleware';


async function sessionTableExists(): Promise<boolean> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'web_sessions'");
    return rows.length > 0;
  } catch (error) {
    console.error('[startup] Could not reach the database:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function createSessionStore(isProduction: boolean): Promise<session.Store | undefined> {
  if (process.env.SESSION_STORE === 'memory' && !isProduction) {
    console.warn('[startup] SESSION_STORE=memory: logins will be lost on every restart.');
    return undefined;
  }
  if (await sessionTableExists()) return new MySqlSessionStore({ ttlMs: sessionConfig.maxMs });
  if (isProduction) {
    throw new Error('Table web_sessions is missing. Run migrations/20261029_web_sessions.sql before starting in production.');
  }
  console.warn('[startup] Table web_sessions not found; using in-memory sessions. Run migrations/20261029_web_sessions.sql.');
  return undefined;
}

export async function createApp(httpServer?: HttpServer) {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET;

  // Never run production with a missing or weak session secret.
  if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters in production.');
  }

  app.disable('x-powered-by');
  app.set('trust proxy', isProduction ? 1 : false);
  app.use(securityHeaders);
  app.use(express.json({ limit: '2mb' }));

  app.use(session({
    name: SESSION_COOKIE,
    store: await createSessionStore(isProduction),
    secret: sessionSecret || 'local-development-only-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    // The cookie lives for the maximum session length from sign-in; the idle
    // limit is enforced server-side in requireAuth on every request.
    rolling: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: sessionConfig.maxMs,
      path: '/',
    },
  }));

  const api = express.Router();
  api.use(noStore, csrfGuard, requireCurrentContext);
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  api.use('/auth', authRoutes);
  api.use('/access', accessRoutes);
  api.use('/email', emailRoutes);
  api.use('/slack', slackRoutes);
  api.use('/hrms/masters', mastersRoutes);
  api.use('/hrms', settingsRoutes); // shifts, biometric machines, organization settings
  api.use('/hrms', holidayRoutes); // holiday calendar
  api.use('/hrms', employeeRoutes); // employee accounts, profiles, roles, password resets
  api.use('/hrms', attendanceRoutes); // biometric attendance (read-only, from the Attendance punch table)
  api.use('/hrms', manualAttendanceRoutes); // manual attendance requests
  api.use('/hrms', outdoorDutyRoutes); // outdoor duty (OD) requests
  api.use(apiNotFound);
  app.use('/api', api);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: httpServer ? { server: httpServer } : true,
        hmr: httpServer ? { server: httpServer } : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const buildPath = path.join(process.cwd(), 'build');
    const staticPath = fs.existsSync(distPath) ? distPath : buildPath;

    // Vite fingerprints files under /assets, so they can be cached forever.
    app.use('/assets', express.static(path.join(staticPath, 'assets'), { maxAge: '365d', immutable: true }));
    app.use(express.static(staticPath, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
