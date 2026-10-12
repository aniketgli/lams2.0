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

    httpServer.listen(port, listenHost, () => {
      console.log(`Server listening on http://${listenHost}:${port}`);
    });
  };

  start().catch((err) => {
    console.error('Fatal Server Startup Error:', err);
    process.exit(1);
  });
}
