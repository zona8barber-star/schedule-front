import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { UserNotificationItem } from '../../models/notification.models';
import { NotificationCenterService } from '../../services/notification-center.service';
import { formatRelativeTime } from '../../utils/relative-time.utils';

interface PanelPosition {
  top: number;
  right: number;
  width: number;
}

const panelMaxWidthPx = 368;
const viewportGutterPx = 8;

@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
    '(window:resize)': 'close()',
  },
})
export class NotificationBellComponent {
  readonly center = inject(NotificationCenterService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly isOpen = signal(false);
  readonly panelPosition = signal<PanelPosition>({ top: 0, right: 0, width: panelMaxWidthPx });
  private readonly now = signal(Date.now());

  readonly unreadCount = this.center.unreadCount;
  readonly badgeLabel = computed(() => {
    const count = this.unreadCount();
    return count > 99 ? '99+' : String(count);
  });
  readonly ariaLabel = computed(() => {
    const count = this.unreadCount();
    return count === 0
      ? 'Notificaciones'
      : `Notificaciones, ${count} sin leer`;
  });

  toggle(): void {
    if (this.isOpen()) {
      this.close();
      return;
    }

    // Panel position: fixed, alineado al borde derecho de la campana pero siempre dentro de la pantalla
    // (en el celular el botón de menú queda a la derecha de la campana).
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const width = Math.min(panelMaxWidthPx, viewportWidth - viewportGutterPx * 2);
    const maxRight = viewportWidth - width - viewportGutterPx;
    const right = Math.min(Math.max(viewportGutterPx, Math.round(viewportWidth - rect.right)), maxRight);

    this.panelPosition.set({
      top: Math.round(rect.bottom + 8),
      right: Math.max(viewportGutterPx, right),
      width,
    });
    this.now.set(Date.now());
    this.isOpen.set(true);
    void this.center.refresh();
  }

  close(): void {
    this.isOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node | null)) {
      this.close();
    }
  }

  async open(item: UserNotificationItem): Promise<void> {
    this.close();
    void this.center.markAsRead(item);

    if (item.url?.startsWith('/')) {
      await this.router.navigateByUrl(item.url);
    }
  }

  markAllAsRead(): void {
    void this.center.markAllAsRead();
  }

  timeAgo(isoDate: string): string {
    return formatRelativeTime(isoDate, this.now());
  }
}
