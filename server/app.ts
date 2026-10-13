import express from 'express';
import path from 'path';
import fs from 'fs';
import type { Server as HttpServer } from 'http';
import { createServer as createViteServer } from 'vite';
import { emailRoutes } from './integrations/email/email.routes';
import { slackRoutes } from './integrations/slack/slack.routes';
import { authRoutes } from './routes/auth.routes';
import hrmsRoutes from './routes/hrms.routes';
import { errorHandler } from './middleware/errorHandler';
import session from 'express-session';

export async function createApp(httpServer?: HttpServer) {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Session Middleware (needs MySQL store, here just basic for now)
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret_only_for_development',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  }));
  
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('WARNING: SESSION_SECRET is not set. Using insecure fallback secret in production.');
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api/slack', slackRoutes);
  app.use('/api/hrms', hrmsRoutes);

  // Vite Middleware (Development) vs Static Assets (Production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        // Vite runs inside our Express HTTP server. Passing the parent
        // server keeps HMR/WebSocket traffic on the same LAN port.
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
