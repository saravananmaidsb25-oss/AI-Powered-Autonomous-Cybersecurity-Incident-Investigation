import {defineConfig} from '@playwright/test';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';

const port=process.env.SENTINEL_X_E2E_PORT||'4174';
const baseURL=`http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL,
    ...(process.env.SENTINEL_X_E2E_CHANNEL?{channel:process.env.SENTINEL_X_E2E_CHANNEL}:{}),
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server.js',
    url: `${baseURL}/api/health`,
    env: {PORT:port,SENTINEL_X_DB_PATH:join(tmpdir(),`sentinel-e2e-${randomUUID()}.db`),SENTINEL_X_TELEMETRY_TOKEN:'e2e-fixture-telemetry-token-not-for-production'},
    reuseExistingServer: false,
    timeout: 120000,
  },
});
