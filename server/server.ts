import 'dotenv/config';
import http from 'http';
import os from 'os';
import { createApp } from './app';
import { startReportScheduler, stopReportScheduler } from './reports/scheduler';
import { envConfig } from './config/env.config';
import { pool } from '../src/db';

function getLanIPv4Addresses(): string[] {
  const addresses = new Set<string>();
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.add(entry.address);
    }
  }
  return [...addresses];
}

function printBanner(port: number): void {
  const mode = envConfig.isProduction ? 'Production' : 'Development';
  const lan = getLanIPv4Addresses();
  console.log(`\n==============================================\n  WII Portal - ${mode} Server\n==============================================`);
  console.log(`  Local:   http://localhost:${port}`);
  if (!envConfig.isProduction) for (const address of lan) console.log(`  LAN:     http://${address}:${port}`);
  console.log('==============================================\n');
}

/**
 * Stops taking new requests, lets running ones finish (up to 10 s), then closes the database pool.
 * Used for SIGTERM / SIGINT, so a deploy or restart does not cut a request in the middle of a write.
 */
function installShutdown(server: http.Server): void {
  let closing = false;
  const shutdown = (signal: string): void => {
    if (closing) return;
    closing = true;
    console.log(`[shutdown] ${signal} received, closing…`);
    stopReportScheduler();
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(() => {
      pool.end().catch(() => undefined).finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Failures nobody caught are logged in full. A rejected promise is a bug in one request, so the server keeps
 * running; an uncaught exception leaves the process in an unknown state, so it exits and the process manager restarts it.
 */
function installProcessErrorHandlers(): void {
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason instanceof Error ? reason.stack || reason.message : reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('[uncaughtException]', error.stack || error.message);
    process.exit(1);
  });
}

/** Starts the portal: API + web pages on one port, then the report scheduler. The single entry point for `npm run dev` and `npm start`. */
export async function startServer(): Promise<void> {
  installProcessErrorHandlers();
  // One HTTP server for Express + Vite so the portal, API and HMR share one address.
  const httpServer = http.createServer();
  const app = await createApp(httpServer);
  httpServer.on('request', app);
  installShutdown(httpServer);
  httpServer.listen(envConfig.port, envConfig.host, () => {
    printBanner(envConfig.port);
    startReportScheduler(); // sends the scheduled report emails when they are due
  });
}
