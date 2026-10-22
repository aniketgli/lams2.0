import express from 'express';
import path from 'path';
import fs from 'fs';
import type { Server as HttpServer } from 'http';
import { createServer as createViteServer } from 'vite';
import { emailRoutes } from './integrations/email/email.routes';
import { slackRoutes } from './integrations/slack/slack.routes';
import { authRoutes } from './routes/auth.routes';
import accessRoutes from './routes/access.routes';
import hrmsRoutes from './routes/hrms.routes';
import { errorHandler } from './middleware/errorHandler';
import session from 'express-session';

export async function createApp(httpServer?: HttpServer) {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  const isProduction = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET;

  // Never silently run production with a known, insecure session secret.
  if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters in production.');
  }

  app.set('trust proxy', isProduction ? 1 : false);
  app.use(session({
    name: 'connect.sid',
    secret: sessionSecret || 'local-development-only-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    }
  }));

  // Do not let browsers or shared proxies cache authenticated API responses.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/access', accessRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api/slack', slackRoutes);
  app.use('/api/hrms', hrmsRoutes);

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: httpServer ? { server: httpServer } : true,
        hmr: httpServer ? { server: httpServer } : undefined
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const buildPath = path.join(process.cwd(), 'build');
    const staticPath = fs.existsSync(distPath) ? distPath : buildPath;

    app.use(express.static(staticPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
