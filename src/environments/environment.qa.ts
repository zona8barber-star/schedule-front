import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  name: 'qa',
  runtimeConfigPath: '/config.qa.json',
  enableServiceWorker: true,
  defaultApiBaseUrl: 'https://qa-api.example.com/api/v1',
  defaultAppName: 'Barbershop QA',
  defaultAppUrl: 'https://qa.example.com',
  defaultAssetsBaseUrl: 'https://qa.example.com/assets',
  defaultEnvironmentName: 'QA',
};
