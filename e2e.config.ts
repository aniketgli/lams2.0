import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

// End-to-end tests (https://github.com/tester-army/e2e).
// The tests in tests/ use locators and assertions only, so no AI model is needed yet.
// To use `agent` steps later, add a model under `agents.default.model`
// (see node_modules/e2e/docs/models.mdx).
export default {
  targets: [
    {
      engine: web(),
      app: {
        url: process.env.E2E_APP_URL ?? 'http://localhost:3000',
        // The runner starts the portal (Express + Vite) and waits for the URL to answer.
        // Outside CI, a portal you already started on that port is reused.
        command: { executable: 'npm', args: ['run', 'dev'], reuseExisting: true },
      },
    },
  ],
} satisfies E2EConfig;
