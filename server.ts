import { spawn } from 'child_process';
import process from 'process';

// Ensure TypeScript module resolution works seamlessly when executed via `node server.ts`
if (!process.execArgv.some(arg => arg.includes('tsx')) && !process.env.TSX_SPAWNED) {
  const child = spawn(process.execPath, ['--import', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_SPAWNED: '1' }
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    }
    process.exit(code ?? 0);
  });
} else {
  // Start server
  const start = async () => {
    await import('dotenv/config');
    const http = await import('http');
    const { createApp } = await import('./server/app.ts');
    const { envConfig } = await import('./server/config/env.config.ts');

    const httpServer = http.createServer();
    const app = await createApp(httpServer);
    httpServer.on('request', app);

    const port = Number(process.env.PORT) || envConfig.port || 3000;
    const listenHost = '0.0.0.0';

    httpServer.listen(port, listenHost, async () => {
      // 0.0.0.0 means "every network card": print the addresses people actually open.
      const { networkInterfaces } = await import('node:os');
      const lan = Object.values(networkInterfaces()).flat()
        .filter((a): a is NonNullable<typeof a> => Boolean(a) && a!.family === 'IPv4' && !a!.internal)
        .map((a) => a.address);
      console.log('Server is running. Open it at:');
      console.log(`  This computer:  http://localhost:${port}`);
      for (const ip of lan) console.log(`  On the network: http://${ip}:${port}`);
      // Background jobs. (This file is what `npm run dev` / `npm start` run; without these lines queued notification
      // emails waited forever and scheduled reports were never sent.)
      const { startReportScheduler } = await import('./server/reports/scheduler.ts');
      const { logEmailReadiness } = await import('./server/masters/emailSettings.ts');
      const { startOutboxWorker } = await import('./server/notifications/outbox.ts');
      startReportScheduler();      // sends scheduled report emails when they are due
      void logEmailReadiness();    // says in the log whether notification emails can go out, and if not, why
      startOutboxWorker();         // sends queued notification emails and retries failed ones
    });
  };

  start().catch((err) => {
    console.error('Fatal Server Startup Error:', err);
    process.exit(1);
  });
}
