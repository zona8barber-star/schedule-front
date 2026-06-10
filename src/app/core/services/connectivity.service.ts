import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ConnectivityService {
  private readonly hasBrowserContext = typeof window !== 'undefined';

  private readonly online = signal(this.detectInitialOnlineState());

  // True once we've gone offline at least once, so the "back online" banner
  // only appears after a real outage rather than on first load.
  private readonly wasOffline = signal(false);

  readonly isOffline = computed(() => !this.online());
  readonly justReconnected = computed(() => this.online() && this.wasOffline());

  constructor() {
    if (!this.hasBrowserContext) {
      return;
    }

    window.addEventListener('offline', () => {
      this.online.set(false);
      this.wasOffline.set(true);
    });

    window.addEventListener('online', () => {
      this.online.set(true);
    });
  }

  acknowledgeReconnect(): void {
    this.wasOffline.set(false);
  }

  private detectInitialOnlineState(): boolean {
    if (!this.hasBrowserContext || typeof navigator === 'undefined') {
      return true;
    }

    return navigator.onLine;
  }
}
