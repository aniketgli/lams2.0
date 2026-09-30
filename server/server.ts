import { createApp } from './app';
import { envConfig } from './config/env.config';

async function bootstrap() {
  try {
    const app = await createApp();
    const port = 3000;
    const host = '0.0.0.0';

    app.listen(port, host, () => {
      console.log(`Server running at http://${host}:${port}`);
    });
  } catch (error) {
    console.error('Fatal Server Startup Error:', error);
    process.exit(1);
  }
}

bootstrap();
