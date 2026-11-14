import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

import { UserNotificationItem } from '../models/notification.models';
import { AuthService } from './auth.service';
import { NotificationsApiService } from './notifications-api.service';

export const NOTIFICATION_INBOX_LIMIT = 5;
/** Lo máximo que la API entrega en una sola página. */
export const NOTIFICATION_INBOX_MAX_LIMIT = 50;
const pollIntervalMs = 60_000;

/**
 * Estado de la campana: últimas notificaciones y cantidad sin leer del usuario actual.
 * Se refresca al iniciar sesión, al llegar un push con la app abierta, al tocar un push,
 * al volver a la pestaña y cada minuto mientras la app está visible.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationCenterService {
  private readonly api = inject(NotificationsApiService);
  private readonly authService = inject(AuthService);
  private readonly swPush = inject(SwPush);
  private readonly destroyRef = inject(DestroyRef);

  private readonly itemsState = signal<UserNotificationItem[]>([]);
  private readonly unreadCountState = signal(0);
  private readonly loadingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly hasMoreState = signal(false);
  private readonly loadingMoreState = signal(false);
  /** BUG-107: cuántas notificaciones muestra el panel; «Ver más» lo amplía y al abrirlo vuelve a la primera página. */
  private windowSize = NOTIFICATION_INBOX_LIMIT;
  private readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private requestSequence = 0;

  readonly items = this.itemsState.asReadonly();
  readonly unreadCount = this.unreadCountState.asReadonly();
  readonly isLoading = this.loadingState.asReadonly();
  readonly hasLoaded = this.loadedState.asReadonly();
  readonly hasMore = this.hasMoreState.asReadonly();
  readonly isLoadingMore = this.loadingMoreState.asReadonly();

  constructor() {
    effect(() => {
      const userId = this.currentUserId();

      untracked(() => {
        this.reset();

        if (userId) {
          void this.refresh();
          this.startPolling();
        } else {
          this.stopPolling();
          this.updateAppBadge(0);
        }
      });
    });

    if (this.swPush.isEnabled) {
      this.swPush.messages.pipe(takeUntilDestroyed()).subscribe(() => void this.refresh());
      this.swPush.notificationClicks.pipe(takeUntilDestroyed()).subscribe(() => void this.refresh());
    }

    if (typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          void this.refresh();
        }
      };

      document.addEventListener('visibilitychange', onVisibilityChange);
      this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisibilityChange));
    }

    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  /**
   * Recarga lo que muestra el panel. Las sin leer llegan primero (BUG-107), así el contador y la lista coinciden.
   * Con `firstPage` vuelve a mostrar solo la primera página (al abrir el panel).
   */
  async refresh(options: { firstPage?: boolean } = {}): Promise<void> {
    if (!this.currentUserId()) {
      return;
    }

    if (options.firstPage) {
      this.windowSize = NOTIFICATION_INBOX_LIMIT;
    }

    const sequence = ++this.requestSequence;
    this.loadingState.set(true);

    try {
      const inbox = await firstValueFrom(this.api.getInbox(this.windowSize));

      // Ignorar respuestas viejas (otra petición más nueva o cambio de usuario en el medio).
      if (sequence !== this.requestSequence || !this.currentUserId()) {
        return;
      }

      // Más allá del máximo de una página, se conservan las que ya se cargaron por desplazamiento.
      const tail = options.firstPage ? [] : this.itemsState().slice(this.windowSize);
      const fresh = new Set(inbox.items.map((item) => item.id));
      this.itemsState.set([...inbox.items, ...tail.filter((item) => !fresh.has(item.id))]);
      this.hasMoreState.set(inbox.hasMore === true);
      this.unreadCountState.set(inbox.unreadCount);
      this.loadedState.set(true);
      this.updateAppBadge(inbox.unreadCount);
    } catch {
      // Se conserva el último estado; el próximo refresco lo reintenta.
    } finally {
      if (sequence === this.requestSequence) {
        this.loadingState.set(false);
      }
    }
  }

  /**
   * «Ver más»: pide de nuevo la lista desde el principio con una página más (hasta el máximo de la API), para que
   * marcar como leídas no corra el orden y se salte notificaciones. Pasado ese máximo continúa por desplazamiento,
   * sin repetir las que ya están.
   */
  async loadMore(): Promise<void> {
    if (!this.currentUserId() || !this.hasMoreState() || this.loadingMoreState()) {
      return;
    }

    this.loadingMoreState.set(true);
    try {
      if (this.windowSize < NOTIFICATION_INBOX_MAX_LIMIT) {
        this.windowSize = Math.min(this.itemsState().length + NOTIFICATION_INBOX_LIMIT, NOTIFICATION_INBOX_MAX_LIMIT);
        await this.refresh();
        return;
      }

      const sequence = this.requestSequence;
      const page = await firstValueFrom(this.api.getInbox(NOTIFICATION_INBOX_LIMIT, this.itemsState().length));
      if (sequence !== this.requestSequence || !this.currentUserId()) {
        return;
      }

      const known = new Set(this.itemsState().map((item) => item.id));
      this.itemsState.update((items) => [...items, ...page.items.filter((item) => !known.has(item.id))]);
      this.hasMoreState.set(page.hasMore === true);
      this.unreadCountState.set(page.unreadCount);
      this.updateAppBadge(page.unreadCount);
    } catch {
      // Se conserva lo que ya se ve; el botón sigue disponible.
    } finally {
      this.loadingMoreState.set(false);
    }
  }

  async markAsRead(item: UserNotificationItem): Promise<void> {
    if (item.readAtUtc) {
      return;
    }

    const readAtUtc = new Date().toISOString();
    this.itemsState.update((items) =>
      items.map((candidate) => (candidate.id === item.id ? { ...candidate, readAtUtc } : candidate)),
    );
    this.unreadCountState.update((count) => Math.max(0, count - 1));
    this.updateAppBadge(this.unreadCountState());

    try {
      await firstValueFrom(this.api.markNotificationAsRead(item.id));
    } catch {
      void this.refresh();
    }
  }

  async markAllAsRead(): Promise<void> {
    if (this.unreadCountState() === 0) {
      return;
    }

    const readAtUtc = new Date().toISOString();
    this.itemsState.update((items) => items.map((item) => (item.readAtUtc ? item : { ...item, readAtUtc })));
    this.unreadCountState.set(0);
    this.updateAppBadge(0);

    try {
      await firstValueFrom(this.api.markAllNotificationsAsRead());
    } catch {
      void this.refresh();
    }
  }

  private reset(): void {
    this.requestSequence++;
    this.itemsState.set([]);
    this.unreadCountState.set(0);
    this.loadedState.set(false);
    this.loadingState.set(false);
    this.hasMoreState.set(false);
    this.loadingMoreState.set(false);
    this.windowSize = NOTIFICATION_INBOX_LIMIT;
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollHandle = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void this.refresh();
      }
    }, pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  /** Número en el ícono de la app instalada (Chrome/Edge, Android y iOS 16.4+ con la PWA instalada). */
  private updateAppBadge(count: number): void {
    const nav = globalThis.navigator as Navigator & {
      setAppBadge?: (contents?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    try {
      if (count > 0) {
        void nav?.setAppBadge?.(count)?.catch(() => undefined);
      } else {
        void nav?.clearAppBadge?.()?.catch(() => undefined);
      }
    } catch {
      // API no disponible: ignorar.
    }
  }
}
