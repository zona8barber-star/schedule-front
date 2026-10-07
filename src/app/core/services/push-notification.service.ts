import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom, take } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { PushTestResultResponse } from '../models/notification.models';
import { AuthService } from './auth.service';
import { NotificationsApiService } from './notifications-api.service';

const promptDismissedStoragePrefix = 'barbershop.pushPrompt.dismissedAt.';
const optOutStoragePrefix = 'barbershop.push.optOut.';
const legacyPromptDismissedStorageKey = 'barbershop.pushPrompt.dismissed';
const promptSnoozeMs = 14 * 24 * 60 * 60 * 1000;
const maxUserAgentLength = 256;
const detachTimeoutMs = 3000;

/**
 * - `unsupported`: el navegador no soporta push (o el service worker está apagado, p. ej. `ng serve`).
 * - `needs-install`: iPhone/iPad fuera de la app instalada; Apple solo permite push en la PWA instalada.
 * - `not-configured`: el servidor tiene WebPush desactivado o sin llaves.
 * - `blocked`: el usuario bloqueó las notificaciones en el navegador/sistema.
 * - `enabled` / `disabled`: estado de este dispositivo para la cuenta actual.
 */
export type PushStatus =
  | 'unsupported'
  | 'needs-install'
  | 'not-configured'
  | 'blocked'
  | 'enabled'
  | 'disabled';

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
  readonly isIOS =
    this.hasBrowserContext &&
    (/iPad|iPhone|iPod/.test(globalThis.navigator?.userAgent ?? '') ||
      // iPadOS se presenta como Mac con pantalla táctil.
      (globalThis.navigator?.platform === 'MacIntel' && (globalThis.navigator?.maxTouchPoints ?? 0) > 1));
  private readonly isStandaloneMode =
    this.hasBrowserContext &&
    typeof globalThis.window.matchMedia === 'function' &&
    globalThis.window.matchMedia('(display-mode: standalone)').matches;

  private readonly swPush = inject(SwPush);
  private readonly runtimeConfigService = inject(RuntimeConfigService);
  private readonly notificationsApiService = inject(NotificationsApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly subscription = signal<PushSubscription | null>(null);
  private readonly permission = signal<NotificationPermission>(this.readPermission());
  private readonly serverEnabled = signal<boolean | null>(null);
  private readonly dismissedAt = signal<number | null>(null);
  private readonly optedOut = signal(false);
  private readonly enabling = signal(false);
  // computed: solo cambia cuando cambia el id (no en cada refresh de token, que crea un objeto nuevo).
  private readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  private serverKeyPromise: Promise<string | null> | null = null;
  private syncPromise: Promise<void> | null = null;
  private syncQueued = false;
  /** `${userId}|${endpoint}` registrado por última vez en el backend en esta sesión. */
  private syncedKey: string | null = null;

  readonly isSupported = this.hasBrowserContext && this.swPush.isEnabled && this.hasNotificationApi;
  readonly needsInstall = this.isIOS && !this.isStandaloneMode;
  readonly isEnabling = this.enabling.asReadonly();
  readonly isSubscribed = computed(() => this.subscription() !== null && !this.optedOut());

  readonly status = computed<PushStatus>(() => {
    if (this.needsInstall && !this.isSupported) {
      return 'needs-install';
    }

    if (!this.isSupported) {
      return 'unsupported';
    }

    if (this.serverEnabled() === false) {
      return 'not-configured';
    }

    if (this.permission() === 'denied') {
      return 'blocked';
    }

    return this.isSubscribed() && this.permission() === 'granted' ? 'enabled' : 'disabled';
  });

  readonly shouldShowPrompt = computed(() => {
    const dismissedAt = this.dismissedAt();

    return (
      this.isSupported &&
      this.authService.isAuthenticated() &&
      this.serverEnabled() === true &&
      // Si el permiso ya está concedido, la sincronización silenciosa se encarga; no hace falta preguntar.
      this.permission() === 'default' &&
      !this.subscription() &&
      !this.optedOut() &&
      (dismissedAt === null || Date.now() - dismissedAt > promptSnoozeMs) &&
      // iOS solo soporta push cuando la app está instalada (standalone).
      !this.needsInstall
    );
  });

  constructor() {
    this.removeStorage(legacyPromptDismissedStorageKey);

    if (!this.isSupported) {
      return;
    }

    this.swPush.subscription.pipe(takeUntilDestroyed()).subscribe((subscription) => {
      this.subscription.set(subscription);
      this.permission.set(this.readPermission());
      void this.syncWithServer();
    });

    // El navegador puede rotar la suscripción (pushsubscriptionchange). Si pasa con la app abierta,
    // registramos la nueva de inmediato; si pasa con la app cerrada, la sincronización al abrir lo cubre.
    this.swPush.pushSubscriptionChanges
      .pipe(takeUntilDestroyed())
      .subscribe(({ oldSubscription, newSubscription }) => {
        this.syncedKey = null;
        this.subscription.set(newSubscription);

        if (oldSubscription && this.authService.isAuthenticated()) {
          void firstValueFrom(
            this.notificationsApiService.unsubscribe({ endpoint: oldSubscription.endpoint }),
          ).catch(() => undefined);
        }

        void this.syncWithServer();
      });

    // Con la app abierta, el service worker solo enfoca la ventana; la navegación la hacemos aquí.
    this.swPush.notificationClicks.pipe(takeUntilDestroyed()).subscribe(({ notification }) => {
      const url = (notification.data as { url?: string } | null)?.url ?? '/';
      void this.router.navigateByUrl(url.startsWith('/') ? url : '/');
    });

    this.authService.registerBeforeLogout(() => this.detachFromCurrentUser());

    // Cada vez que cambia el usuario (login, logout, cambio de cuenta en un dispositivo compartido)
    // se recalcula el estado por usuario y se vuelve a vincular la suscripción del dispositivo.
    effect(() => {
      const userId = this.currentUserId();

      untracked(() => {
        this.syncedKey = null;
        this.dismissedAt.set(userId ? this.readDismissedAt(userId) : null);
        this.optedOut.set(userId ? this.readStorage(optOutStoragePrefix + userId) === '1' : false);

        if (userId) {
          void this.loadServerKey();
          void this.syncWithServer();
        }
      });
    });
  }

  dismissPrompt(): void {
    const userId = this.authService.currentUser()?.id;
    const now = Date.now();
    this.dismissedAt.set(now);

    if (userId) {
      this.writeStorage(promptDismissedStoragePrefix + userId, String(now));
    }
  }

  /** Llamar desde un gesto del usuario (click). null = éxito; string = mensaje para mostrar. */
  async enable(): Promise<string | null> {
    if (this.needsInstall && !this.isStandaloneMode) {
      return 'En iPhone primero instala la app: Compartir → Agregar a inicio, y ábrela desde el ícono.';
    }

    if (!this.isSupported) {
      return 'Este navegador no soporta notificaciones.';
    }

    if (this.enabling()) {
      return null;
    }

    // iOS exige pedir el permiso directamente dentro del gesto del usuario, antes de cualquier await de red.
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      this.permission.set(result);

      if (result === 'denied') {
        return 'Bloqueaste las notificaciones. Puedes activarlas desde los ajustes del navegador o del teléfono.';
      }

      if (result !== 'granted') {
        return null; // El usuario cerró el diálogo sin decidir.
      }
    }

    if (Notification.permission === 'denied') {
      this.permission.set('denied');
      return 'Las notificaciones están bloqueadas. Actívalas desde los ajustes del navegador o del teléfono.';
    }

    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      return 'Inicia sesión para activar las notificaciones.';
    }

    this.enabling.set(true);
    this.setOptOut(userId, false);

    try {
      const serverKey = await this.loadServerKey(true);
      if (!serverKey) {
        return 'Las notificaciones no están configuradas en el servidor.';
      }

      let subscription: PushSubscription;
      try {
        subscription = await this.ensureBrowserSubscription(serverKey);
      } catch (error) {
        console.error('[Push] Browser subscription failed', error);
        return `No se pudo activar en este dispositivo (${this.describeError(error)}).`;
      }

      try {
        await this.registerWithServer(subscription);
      } catch (error) {
        console.error('[Push] Saving the subscription on the server failed', error);
        return 'No se pudo registrar este dispositivo en el servidor. Intenta de nuevo.';
      }

      this.syncedKey = `${userId}|${subscription.endpoint}`;
      this.subscription.set(subscription);
      return null;
    } finally {
      this.permission.set(this.readPermission());
      this.enabling.set(false);
    }
  }

  /** Desactiva las notificaciones de esta cuenta en este dispositivo y recuerda la decisión. */
  async disable(): Promise<void> {
    const userId = this.authService.currentUser()?.id;
    if (userId) {
      this.setOptOut(userId, true);
    }

    const subscription = this.subscription();
    this.syncedKey = null;

    if (!subscription) {
      return;
    }

    const endpoint = subscription.endpoint;

    try {
      await firstValueFrom(this.notificationsApiService.unsubscribe({ endpoint }));
    } catch {
      // Best-effort: el backend también limpia endpoints vencidos al enviar.
    }

    try {
      await subscription.unsubscribe();
    } catch {
      // Ignorar: la suscripción local puede haber expirado ya.
    } finally {
      this.subscription.set(null);
    }
  }

  sendTest(): Promise<PushTestResultResponse> {
    return firstValueFrom(this.notificationsApiService.sendTestPush());
  }

  /**
   * Antes de cerrar sesión: desvincula el dispositivo de la cuenta en el backend para que deje de recibir
   * sus notificaciones. La suscripción del navegador se conserva para que el próximo usuario la reutilice.
   */
  private async detachFromCurrentUser(): Promise<void> {
    const subscription = this.subscription();
    this.syncedKey = null;

    if (!subscription) {
      return;
    }

    const request = firstValueFrom(
      this.notificationsApiService.unsubscribe({ endpoint: subscription.endpoint }),
    ).catch(() => undefined);

    await Promise.race([request, new Promise((resolve) => setTimeout(resolve, detachTimeoutMs))]);
  }

  /**
   * Idempotente: con sesión y permiso concedido, asegura que este dispositivo tenga una suscripción
   * creada con la llave actual del servidor y vinculada al usuario actual en el backend.
   */
  private syncWithServer(): Promise<void> {
    if (this.syncPromise) {
      // Algo cambió (usuario, suscripción) mientras otra sincronización estaba en curso: repetir al terminar.
      this.syncQueued = true;
      return this.syncPromise;
    }

    this.syncPromise = this.runSync().finally(() => {
      this.syncPromise = null;

      if (this.syncQueued) {
        this.syncQueued = false;
        void this.syncWithServer();
      }
    });

    return this.syncPromise;
  }

  private async runSync(): Promise<void> {
    const userId = this.authService.currentUser()?.id;

    if (
      !this.isSupported ||
      !userId ||
      this.optedOut() ||
      this.enabling() ||
      this.readPermission() !== 'granted'
    ) {
      return;
    }

    try {
      const serverKey = await this.loadServerKey();
      if (!serverKey) {
        return;
      }

      const subscription = await this.ensureBrowserSubscription(serverKey);
      const syncKey = `${userId}|${subscription.endpoint}`;

      if (this.syncedKey === syncKey) {
        return;
      }

      await this.registerWithServer(subscription);

      // Solo si el usuario no cambió mientras tanto.
      if (this.authService.currentUser()?.id === userId) {
        this.syncedKey = syncKey;
        this.subscription.set(subscription);
      }
    } catch (error) {
      console.warn('[Push] Background sync failed', error);
    }
  }

  private async ensureBrowserSubscription(serverKey: string): Promise<PushSubscription> {
    let subscription = await firstValueFrom(this.swPush.subscription.pipe(take(1)));

    // Si la llave del servidor cambió, la suscripción vieja ya no sirve (el servicio push respondería 403).
    if (subscription && !this.matchesServerKey(subscription, serverKey)) {
      await subscription.unsubscribe().catch(() => false);
      subscription = null;
    }

    return subscription ?? (await this.swPush.requestSubscription({ serverPublicKey: serverKey }));
  }

  private async registerWithServer(subscription: PushSubscription): Promise<void> {
    const keys = this.extractSubscriptionKeys(subscription);
    if (!keys) {
      throw new Error('No se pudieron leer las claves de la suscripción');
    }

    const userAgent = this.hasBrowserContext
      ? globalThis.navigator.userAgent.slice(0, maxUserAgentLength)
      : null;

    await firstValueFrom(this.notificationsApiService.subscribe({ ...keys, userAgent }));
  }

  /** La llave pública VAPID sale del backend (única fuente de verdad); el config del front es respaldo. */
  private loadServerKey(forceReload = false): Promise<string | null> {
    if (forceReload || !this.serverKeyPromise) {
      this.serverKeyPromise = this.fetchServerKey();
    }

    return this.serverKeyPromise;
  }

  private async fetchServerKey(): Promise<string | null> {
    try {
      const config = await firstValueFrom(this.notificationsApiService.getPushConfig());
      this.serverEnabled.set(config.enabled && !!config.vapidPublicKey);
      return config.enabled ? config.vapidPublicKey : null;
    } catch {
      // Backend sin el endpoint (versión anterior) o sin red: usar la llave del runtime config.
      const fallbackKey = this.runtimeConfigService.config().vapidPublicKey ?? null;
      this.serverEnabled.set(fallbackKey ? true : null);
      this.serverKeyPromise = null; // Reintentar en la próxima sincronización.
      return fallbackKey;
    }
  }

  private matchesServerKey(subscription: PushSubscription, serverKey: string): boolean {
    const currentKey = subscription.options?.applicationServerKey;
    if (!currentKey) {
      return true; // El navegador no expone la llave: no podemos comparar.
    }

    const expected = this.decodeBase64Url(serverKey);
    const actual = new Uint8Array(currentKey);

    return expected !== null && expected.length === actual.length && expected.every((byte, i) => byte === actual[i]);
  }

  private decodeBase64Url(value: string): Uint8Array | null {
    try {
      const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const binary = atob(padded);
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch {
      return null;
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

  private describeError(error: unknown): string {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  private setOptOut(userId: string, value: boolean): void {
    this.optedOut.set(value);
    this.writeStorage(optOutStoragePrefix + userId, value ? '1' : null);
  }

  private readDismissedAt(userId: string): number | null {
    const raw = this.readStorage(promptDismissedStoragePrefix + userId);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }

  private readPermission(): NotificationPermission {
    if (!this.hasNotificationApi) {
      return 'denied';
    }

    return Notification.permission;
  }

  private readStorage(key: string): string | null {
    if (!this.hasBrowserContext) {
      return null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string | null): void {
    if (!this.hasBrowserContext) {
      return;
    }

    try {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignorar errores de localStorage (modo privado, cuota, etc.).
    }
  }

  private removeStorage(key: string): void {
    this.writeStorage(key, null);
  }
}
