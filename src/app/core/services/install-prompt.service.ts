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

const SNOOZE_KEY = 'barbershop.installPrompt.snoozedUntil';
const INSTALLED_KEY = 'barbershop.installPrompt.installed';
const SNOOZE_DAYS = 3;

@Injectable({
  providedIn: 'root',
})
export class InstallPromptService {
  private readonly hasBrowserContext = typeof window !== 'undefined';
  private readonly deferredPromptEvent = signal<BeforeInstallPromptEvent | null>(null);
  private readonly snoozed = signal(false);
  private readonly installed = signal(false);

  readonly isStandalone = signal(this.detectStandaloneMode());
  readonly isIos = signal(this.detectIos());
  readonly isInstallAvailable = computed(() => this.deferredPromptEvent() !== null);

  readonly shouldShowPrompt = computed(
    () =>
      !this.isStandalone() &&
      !this.snoozed() &&
      !this.installed() &&
      (this.isIos() || this.isInstallAvailable()),
  );

  constructor() {
    if (!this.hasBrowserContext) {
      return;
    }

    this.snoozed.set(this.readSnoozed());
    this.installed.set(this.readInstalled());

    window
      .matchMedia('(display-mode: standalone)')
      .addEventListener('change', (event) => this.isStandalone.set(event.matches));

    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.deferredPromptEvent.set(event as BeforeInstallPromptEvent);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPromptEvent.set(null);
      this.installed.set(true);
      this.persistInstalled();
    });
  }

  dismissPrompt(): void {
    const until = Date.now() + SNOOZE_DAYS * 86_400_000;
    this.snoozed.set(true);
    this.persistSnooze(until);
  }

  async promptInstall(): Promise<void> {
    const event = this.deferredPromptEvent();
    if (!event) {
      return;
    }

    await event.prompt();
    const choice = await event.userChoice;
    this.deferredPromptEvent.set(null);

    if (choice.outcome === 'accepted') {
      this.installed.set(true);
      this.persistInstalled();
    }
  }

  private detectStandaloneMode(): boolean {
    if (!this.hasBrowserContext) {
      return false;
    }

    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  private detectIos(): boolean {
    if (!this.hasBrowserContext) {
      return false;
    }

    const ua = navigator.userAgent;
    // iPadOS 13+ se reporta como 'Macintosh' pero tiene maxTouchPoints > 1
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  }

  private readSnoozed(): boolean {
    if (!this.hasBrowserContext) {
      return false;
    }

    try {
      const val = window.localStorage.getItem(SNOOZE_KEY);
      if (!val) return false;
      return Date.now() < Number(val);
    } catch {
      return false;
    }
  }

  private readInstalled(): boolean {
    if (!this.hasBrowserContext) {
      return false;
    }

    try {
      return window.localStorage.getItem(INSTALLED_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persistSnooze(until: number): void {
    if (!this.hasBrowserContext) {
      return;
    }

    try {
      window.localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {}
  }

  private persistInstalled(): void {
    if (!this.hasBrowserContext) {
      return;
    }

    try {
      window.localStorage.setItem(INSTALLED_KEY, '1');
    } catch {}
  }
}
