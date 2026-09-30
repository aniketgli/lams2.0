import 'dotenv/config';
import http from 'http';
import os from 'os';
import { createApp } from './app';
import { envConfig } from './config/env.config';

function getLanIPv4Addresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses = new Set<string>();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.add(entry.address);
      }
    }
  }

  return [...addresses];
}

async function bootstrap() {
  try {
    // Use one HTTP server for Express + Vite so the portal, API and HMR
    // are all available through the same LAN IP and port.
    const httpServer = http.createServer();
    const app = await createApp(httpServer);

    httpServer.on('request', app);

    httpServer.listen(envConfig.port, envConfig.host, () => {
      const port = envConfig.port;
      const lanAddresses = getLanIPv4Addresses();

      console.log('');
      console.log('==============================================');
      console.log('  WII Enterprise Portal - Development Server');
      console.log('==============================================');
      console.log(`  Local:   http://localhost:${port}`);

      if (envConfig.host === '0.0.0.0' && lanAddresses.length > 0) {
        console.log('  LAN:');
        for (const address of lanAddresses) {
          console.log(`           http://${address}:${port}`);
        }
      } else if (envConfig.host !== '127.0.0.1' && envConfig.host !== 'localhost') {
        console.log(`  Host:    http://${envConfig.host}:${port}`);
      }

      console.log('');
      console.log('  Run "npm run dev" and open the LAN URL from');
      console.log('  another computer/device on the same network.');
      console.log('==============================================');
      console.log('');
    });
  } catch (error) {
    console.error('Fatal Server Startup Error:', error);
    process.exit(1);
  }
}

bootstrap();
