import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { emailRoutes } from './integrations/email/email.routes';
import { slackRoutes } from './integrations/slack/slack.routes';
import { errorHandler } from './middleware/errorHandler';

export async function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/email', emailRoutes);
  app.use('/api/slack', slackRoutes);

  // Vite Middleware (Development) vs Static Assets (Production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
