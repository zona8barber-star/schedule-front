import { Injectable, computed, signal } from '@angular/core';

type InstallPromptOutcome = 'accepted' | 'dismissed';

interface InstallPromptChoice {
  outcome: InstallPromptOutcome;
  platform: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallPromptChoice>;
}

const installPromptDismissedStorageKey = 'barbershop.installPrompt.dismissed';

@Injectable({
  providedIn: 'root',
})
export class InstallPromptService {
  private readonly hasBrowserContext = typeof window !== 'undefined';
  private readonly deferredPromptEvent = signal<BeforeInstallPromptEvent | null>(null);
  private readonly dismissed = signal(false);

  readonly isInstallAvailable = computed(() => this.deferredPromptEvent() !== null);
  readonly shouldShowPrompt = computed(
    () => this.isInstallAvailable() && !this.dismissed(),
  );

  constructor() {
    if (!this.hasBrowserContext) {
      return;
    }

    this.dismissed.set(this.readDismissedFlag());

    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.deferredPromptEvent.set(event as BeforeInstallPromptEvent);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPromptEvent.set(null);
      this.dismissed.set(true);
      this.persistDismissedFlag(true);
    });
  }

  dismissPrompt(): void {
    this.dismissed.set(true);
    this.persistDismissedFlag(true);
  }

  async promptInstall(): Promise<void> {
    const installPromptEvent = this.deferredPromptEvent();
    if (!installPromptEvent) {
      return;
    }

    await installPromptEvent.prompt();

    const choice = await installPromptEvent.userChoice;
    const accepted = choice.outcome === 'accepted';

    this.deferredPromptEvent.set(null);
    this.dismissed.set(accepted);
    this.persistDismissedFlag(accepted);
  }

  private readDismissedFlag(): boolean {
    if (!this.hasBrowserContext) {
      return false;
    }

    try {
      return window.localStorage.getItem(installPromptDismissedStorageKey) === '1';
    } catch {
      return false;
    }
  }

  private persistDismissedFlag(value: boolean): void {
    if (!this.hasBrowserContext) {
      return;
    }

    try {
      if (value) {
        window.localStorage.setItem(installPromptDismissedStorageKey, '1');
      } else {
        window.localStorage.removeItem(installPromptDismissedStorageKey);
      }
    } catch {
      // Ignore localStorage write errors.
    }
  }
}
