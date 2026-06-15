/**
 * Vercel build entry point.
 *
 * Reads BUILD_ENV (defaults to "production") and optionally overwrites the
 * corresponding public/config.<env>.json from Vercel environment variables
 * before delegating to `ng build --configuration <env>`.
 *
 * Vercel env vars → config.json keys:
 *   RUNTIME_API_BASE_URL      → apiBaseUrl       (required to trigger override)
 *   RUNTIME_APP_NAME          → appName
 *   RUNTIME_APP_URL           → appUrl
 *   RUNTIME_ASSETS_BASE_URL   → assetsBaseUrl
 *   RUNTIME_ENVIRONMENT_NAME  → environmentName
 *   RUNTIME_VAPID_PUBLIC_KEY  → vapidPublicKey
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const requestedEnv = (process.env.BUILD_ENV ?? 'production').trim().toLowerCase();
const envAliases = {
  prod: 'production',
  production: 'production',
  qa: 'qa',
  dev: 'development',
  development: 'development',
};

const env = envAliases[requestedEnv];

if (!env) {
  throw new Error(
    `[vercel-build] Unsupported BUILD_ENV "${process.env.BUILD_ENV}". Use one of: production, prod, qa, development, dev.`,
  );
}

const apiBaseUrl = process.env.RUNTIME_API_BASE_URL;
if (apiBaseUrl) {
  const config = {
    apiBaseUrl,
    appName: process.env.RUNTIME_APP_NAME ?? 'Barbershop',
    appUrl: process.env.RUNTIME_APP_URL ?? '',
    assetsBaseUrl: process.env.RUNTIME_ASSETS_BASE_URL ?? '',
    environmentName: process.env.RUNTIME_ENVIRONMENT_NAME ?? env,
    ...(process.env.RUNTIME_VAPID_PUBLIC_KEY
      ? { vapidPublicKey: process.env.RUNTIME_VAPID_PUBLIC_KEY }
      : {}),
  };
  const configPath = resolve(ROOT, `public/config.${env}.json`);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log(`[vercel-build] Wrote runtime config → ${configPath}`);
}

console.log(`[vercel-build] Building with configuration: ${env}`);
execFileSync(
  process.execPath,
  [resolve(ROOT, 'node_modules/@angular/cli/bin/ng.js'), 'build', '--configuration', env],
  { stdio: 'inherit', cwd: ROOT },
);
