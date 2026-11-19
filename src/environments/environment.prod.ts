import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'production',
  runtimeConfigPath: '/config.production.json',
  enableServiceWorker: true,
  defaultApiBaseUrl: 'https://api.zona8.app/api/v1',
  defaultAppName: '',
  defaultAppUrl: 'https://zona8.app',
  defaultAssetsBaseUrl: 'https://zona8.app/assets',
  defaultEnvironmentName: 'Production',
};
