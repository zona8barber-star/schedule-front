import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { RuntimeConfig } from './runtime-config.model';

/** Last configuration served by the site: public data (API address, app name, push key), never anything personal. */
export const RUNTIME_CONFIG_STORAGE_KEY = 'barbershop.runtimeConfig';

function createFallbackRuntimeConfig(): RuntimeConfig {
  return {
    apiBaseUrl: environment.defaultApiBaseUrl,
    appName: environment.defaultAppName,
    appUrl: environment.defaultAppUrl,
    assetsBaseUrl: environment.defaultAssetsBaseUrl,
    environmentName: environment.defaultEnvironmentName,
  };
}

function readStoredConfig(): RuntimeConfig | null {
  try {
    const raw = globalThis.localStorage?.getItem(RUNTIME_CONFIG_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<RuntimeConfig>) : null;
    return parsed && typeof parsed.apiBaseUrl === 'string' && parsed.apiBaseUrl ? (parsed as RuntimeConfig) : null;
  } catch {
    return null;
  }
}

function storeConfig(config: RuntimeConfig): void {
  try {
    globalThis.localStorage?.setItem(RUNTIME_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage unavailable (private mode, quota): the config still works for this visit.
  }
}

@Injectable({
  providedIn: 'root',
})
export class RuntimeConfigService {
  private readonly runtimeConfig = signal<RuntimeConfig>(readStoredConfig() ?? createFallbackRuntimeConfig());
  private loadPromise: Promise<RuntimeConfig> | null = null;
  private loadedFromServer = false;

  readonly config = this.runtimeConfig.asReadonly();

  constructor() {
    // SONDA BUG-065/BUG-045: opened without network, the app used the build placeholders (api.example.com), so even
    // «Reintentar» kept failing once the network was back. The last served config is used meanwhile and the real
    // one is fetched again as soon as the device is online.
    const onOnline = () => {
      if (!this.loadedFromServer) {
        this.loadPromise = null;
        void this.load();
      }
    };
    globalThis.addEventListener?.('online', onOnline);
    inject(DestroyRef).onDestroy(() => globalThis.removeEventListener?.('online', onOnline));
  }

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
      this.loadedFromServer = true;
      storeConfig(config);
      return config;
    } catch {
      return this.runtimeConfig();
    }
  }
}
