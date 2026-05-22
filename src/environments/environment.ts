import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  name: 'development',
  runtimeConfigPath: '/config.development.json',
  enableServiceWorker: false,
  defaultApiBaseUrl: 'http://localhost:5000/api/v1',
  defaultAppName: '',
  defaultAppUrl: 'http://localhost:4200',
  defaultAssetsBaseUrl: 'http://localhost:4200/assets',
  defaultEnvironmentName: 'Development',
};
