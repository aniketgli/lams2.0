import { spawn } from 'child_process';
import process from 'process';

// Entry point of `npm run dev` / `npm start`. The server itself is in server/server.ts.
// Ensure TypeScript module resolution works seamlessly when executed via `node server.ts`
if (!process.execArgv.some((arg) => arg.includes('tsx')) && !process.env.TSX_SPAWNED) {
  const child = spawn(process.execPath, ['--import', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_SPAWNED: '1' },
  });
  // A stop signal sent to this launcher must reach the real server, so it can finish its requests and close cleanly.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
} else {
  import('./server/server.ts')
    .then(({ startServer }) => startServer())
    .catch((error) => {
      console.error('Fatal Server Startup Error:', error);
      process.exit(1);
    });
}
