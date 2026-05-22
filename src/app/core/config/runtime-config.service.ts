import { Injectable, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { RuntimeConfig } from './runtime-config.model';

function createFallbackRuntimeConfig(): RuntimeConfig {
  return {
    apiBaseUrl: environment.defaultApiBaseUrl,
    appName: environment.defaultAppName,
    appUrl: environment.defaultAppUrl,
    assetsBaseUrl: environment.defaultAssetsBaseUrl,
    environmentName: environment.defaultEnvironmentName,
  };
}

@Injectable({
  providedIn: 'root',
})
export class RuntimeConfigService {
  private readonly runtimeConfig = signal<RuntimeConfig>(createFallbackRuntimeConfig());
  private loadPromise: Promise<RuntimeConfig> | null = null;

  readonly config = this.runtimeConfig.asReadonly();

  async load(): Promise<RuntimeConfig> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loadConfig();
    return this.loadPromise;
  }

  private async loadConfig(): Promise<RuntimeConfig> {
    try {
      const response = await fetch(environment.runtimeConfigPath, { cache: 'no-store' });

      if (!response.ok) {
        return this.runtimeConfig();
      }

      const config = (await response.json()) as RuntimeConfig;
      this.runtimeConfig.set(config);
      return config;
    } catch {
      return this.runtimeConfig();
    }
  }
}
