/**
 * Vercel build entry point.
 *
 * Reads BUILD_ENV (defaults to "production") and optionally overwrites the
 * corresponding public/config.<env>.json from Vercel environment variables
 * before delegating to `ng build --configuration <env>`.
 *
 * Vercel env vars → config.json keys:
 *   RUNTIME_API_BASE_URL     → apiBaseUrl       (required to trigger override)
 *   RUNTIME_APP_NAME         → appName
 *   RUNTIME_APP_URL          → appUrl
 *   RUNTIME_ASSETS_BASE_URL  → assetsBaseUrl
 *   RUNTIME_ENVIRONMENT_NAME → environmentName
 */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const env = process.env.BUILD_ENV ?? 'production';

const apiBaseUrl = process.env.RUNTIME_API_BASE_URL;
if (apiBaseUrl) {
  const config = {
    apiBaseUrl,
    appName: process.env.RUNTIME_APP_NAME ?? 'Barbershop',
    appUrl: process.env.RUNTIME_APP_URL ?? '',
    assetsBaseUrl: process.env.RUNTIME_ASSETS_BASE_URL ?? '',
    environmentName: process.env.RUNTIME_ENVIRONMENT_NAME ?? env,
  };
  const configPath = resolve(ROOT, `public/config.${env}.json`);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log(`[vercel-build] Wrote runtime config → ${configPath}`);
}

console.log(`[vercel-build] Building with configuration: ${env}`);
execSync(`npx ng build --configuration ${env}`, { stdio: 'inherit', cwd: ROOT });
