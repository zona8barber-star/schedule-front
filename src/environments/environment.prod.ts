import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'production',
  runtimeConfigPath: '/config.production.json',
  enableServiceWorker: true,
  defaultApiBaseUrl: 'https://api.example.com/api/v1',
  defaultAppName: '',
  defaultAppUrl: 'https://app.example.com',
  defaultAssetsBaseUrl: 'https://app.example.com/assets',
  defaultEnvironmentName: 'Production',
};
