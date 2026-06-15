import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { AuthService } from './auth.service';
import { NotificationsApiService } from './notifications-api.service';

const pushPromptDismissedStorageKey = 'barbershop.pushPrompt.dismissed';

interface SubscriptionKeys {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
}

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private readonly hasBrowserContext = typeof window !== 'undefined';
  private readonly hasNotificationApi = this.hasBrowserContext && 'Notification' in window;
  private readonly isIOS =
    this.hasBrowserContext &&
    /iPad|iPhone|iPod/.test(globalThis.navigator?.userAgent ?? '') &&
    !(globalThis.window as unknown as { MSStream?: unknown }).MSStream;
  private readonly isStandaloneMode =
    this.hasBrowserContext &&
    globalThis.window.matchMedia('(display-mode: standalone)').matches;

  private readonly swPush = inject(SwPush);
  private readonly runtimeConfigService = inject(RuntimeConfigService);
  private readonly notificationsApiService = inject(NotificationsApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly subscription = signal<PushSubscription | null>(null);
  private readonly permission = signal<NotificationPermission>(this.readPermission());
  private readonly dismissed = signal(this.readDismissedFlag());
  private readonly enabling = signal(false);

  readonly isSupported = this.hasBrowserContext && this.swPush.isEnabled && this.hasNotificationApi;
  readonly isEnabling = this.enabling.asReadonly();
  readonly isSubscribed = computed(() => this.subscription() !== null);
  readonly shouldShowPrompt = computed(
    () =>
      this.isSupported &&
      this.authService.isAuthenticated() &&
      // Mostrar también cuando el permiso ya fue concedido pero la suscripción
      // no está registrada (p.ej. falló la llamada a la API en un intento previo).
      this.permission() !== 'denied' &&
      !this.subscription() &&
      !this.dismissed() &&
      // iOS solo soporta push cuando la app está instalada (standalone)
      (!this.isIOS || this.isStandaloneMode),
  );

  constructor() {
    if (!this.isSupported) {
      return;
    }

    this.swPush.subscription.pipe(takeUntilDestroyed()).subscribe((subscription) => {
      this.subscription.set(subscription);
      this.permission.set(this.readPermission());

      if (!subscription && this.readPermission() === 'granted') {
        void this.resubscribeSilently();
      }
    });

    this.swPush.notificationClicks.pipe(takeUntilDestroyed()).subscribe(({ notification }) => {
      const url = (notification.data as { url?: string } | null)?.url ?? '/';
      void this.router.navigateByUrl(url);
    });

    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.dismissed.set(this.readDismissedFlag());
      }
    });
  }

  dismissPrompt(): void {
    this.dismissed.set(true);
    this.persistDismissedFlag(true);
  }

  /** null = éxito; string = mensaje de error para mostrar al usuario */
  async enable(): Promise<string | null> {
    if (!this.isSupported || this.enabling()) {
      return 'Función no disponible en este dispositivo';
    }

    const vapidPublicKey = this.runtimeConfigService.config().vapidPublicKey;
    if (!vapidPublicKey) {
      console.error('[Push] vapidPublicKey not found in runtime config');
      return 'Config: vapidPublicKey no encontrada';
    }

    // iOS Safari (y algunos navegadores) requieren llamar requestPermission()
    // explícitamente antes de crear una suscripción push.
    // SwPush.requestSubscription() no hace este paso por su cuenta.
    if (this.hasNotificationApi && Notification.permission === 'default') {
      const granted = await Notification.requestPermission();
      this.permission.set(granted);
      if (granted !== 'granted') {
        return null; // el usuario canceló el diálogo de permiso; sin mensaje de error
      }
    }

    if (this.hasNotificationApi && Notification.permission === 'denied') {
      this.permission.set('denied');
      return 'Permiso bloqueado — actívalo desde Ajustes del dispositivo';
    }

    this.enabling.set(true);

    try {
      // Paso 1: crear la suscripción en el browser/SW.
      let subscription: PushSubscription;
      try {
        subscription = await this.swPush.requestSubscription({ serverPublicKey: vapidPublicKey });
      } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error('[Push] Browser subscription failed:', msg, err);
        return `Dispositivo: ${msg}`;
      }

      const keys = this.extractSubscriptionKeys(subscription);
      if (!keys) {
        console.error('[Push] Could not extract p256dh/auth keys from subscription');
        await subscription.unsubscribe().catch(() => undefined);
        return 'Dispositivo: no se pudieron leer las claves de suscripción';
      }

      // Paso 2: registrar la suscripción en el backend.
      try {
        await firstValueFrom(
          this.notificationsApiService.subscribe({
            endpoint: keys.endpoint,
            p256dhKey: keys.p256dhKey,
            authKey: keys.authKey,
            userAgent: this.hasBrowserContext ? globalThis.navigator.userAgent : null,
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error('[Push] API call to save subscription failed:', msg, err);
        return `Servidor: ${msg}`;
      }

      this.subscription.set(subscription);
      this.dismissed.set(true);
      this.persistDismissedFlag(true);
      return null; // éxito
    } finally {
      this.permission.set(this.readPermission());
      this.enabling.set(false);
    }
  }

  async disable(): Promise<void> {
    const subscription = this.subscription();
    if (!subscription) {
      return;
    }

    const endpoint = subscription.endpoint;

    try {
      await subscription.unsubscribe();
    } finally {
      this.subscription.set(null);
    }

    try {
      await firstValueFrom(this.notificationsApiService.unsubscribe({ endpoint }));
    } catch {
      // Best-effort: the subscription is already removed locally even if the server call fails.
    }
  }

  private async resubscribeSilently(): Promise<void> {
    const vapidPublicKey = this.runtimeConfigService.config().vapidPublicKey;
    if (!vapidPublicKey) {
      return;
    }

    try {
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: vapidPublicKey });
      const keys = this.extractSubscriptionKeys(subscription);

      if (!keys) {
        await subscription.unsubscribe();
        return;
      }

      await firstValueFrom(
        this.notificationsApiService.subscribe({
          endpoint: keys.endpoint,
          p256dhKey: keys.p256dhKey,
          authKey: keys.authKey,
          userAgent: this.hasBrowserContext ? globalThis.navigator.userAgent : null,
        }),
      );

      this.subscription.set(subscription);
      this.dismissed.set(true);
      this.persistDismissedFlag(true);
    } catch {
      // Silent failure: the user can re-enable manually if needed.
    }
  }

  private extractSubscriptionKeys(subscription: PushSubscription): SubscriptionKeys | null {
    const json = subscription.toJSON();
    const p256dhKey = json.keys?.['p256dh'];
    const authKey = json.keys?.['auth'];

    if (!json.endpoint || !p256dhKey || !authKey) {
      return null;
    }

    return { endpoint: json.endpoint, p256dhKey, authKey };
  }

  private readPermission(): NotificationPermission {
    if (!this.hasNotificationApi) {
      return 'denied';
    }

    return Notification.permission;
  }

  private readDismissedFlag(): boolean {
    if (!this.hasBrowserContext) {
      return false;
    }

    try {
      return window.localStorage.getItem(pushPromptDismissedStorageKey) === '1';
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
        window.localStorage.setItem(pushPromptDismissedStorageKey, '1');
      } else {
        window.localStorage.removeItem(pushPromptDismissedStorageKey);
      }
    } catch {
      // Ignore localStorage write errors.
    }
  }
}
