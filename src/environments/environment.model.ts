export interface AppEnvironment {
  production: boolean;
  name: 'development' | 'qa' | 'production';
  runtimeConfigPath: string;
  enableServiceWorker: boolean;
  defaultApiBaseUrl: string;
  defaultAppName: string;
  defaultAppUrl: string;
  defaultAssetsBaseUrl: string;
  defaultEnvironmentName: string;
}
