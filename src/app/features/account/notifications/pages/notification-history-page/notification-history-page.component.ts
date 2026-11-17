import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { UserNotificationItem } from '../../../../../core/models/notification.models';
import { NotificationCenterService } from '../../../../../core/services/notification-center.service';
import { NotificationsApiService } from '../../../../../core/services/notifications-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { QueryValue, readOptionParam, readPageParam, toQueryParams } from '../../../../../core/utils/list-query.utils';
import { formatRelativeTime } from '../../../../../core/utils/relative-time.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { BogotaDatePipe } from '../../../../../shared/pipes/bogota-date.pipe';

export const NOTIFICATION_HISTORY_PAGE_SIZE = 20;

type HistoryFilter = 'all' | 'unread';
const FILTERS: readonly HistoryFilter[] = ['all', 'unread'];

/**
 * ADR-0019 N5: todas las notificaciones del usuario, las más recientes primero, paginadas, con filtro de sin leer.
 * La página y el filtro viven en la URL (`?page=2&filter=unread`). Marcar como leídas usa la campana
 * (`NotificationCenterService`), así el contador queda igual en las dos.
 */
@Component({
  selector: 'app-notification-history-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent, PaginatorComponent, BogotaDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-history-page.component.html',
  styleUrl: './notification-history-page.component.scss',
})
export class NotificationHistoryPageComponent implements OnInit {
  private readonly api = inject(NotificationsApiService);
  private readonly center = inject(NotificationCenterService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly pageSize = NOTIFICATION_HISTORY_PAGE_SIZE;
  readonly filter = signal<HistoryFilter>('all');
  readonly page = signal(1);
  readonly items = signal<UserNotificationItem[]>([]);
  readonly totalCount = signal(0);
  readonly unreadCount = signal(0);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  private readonly now = signal(Date.now());

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  /** Un filtro nuevo empieza siempre en su primera página. */
  selectFilter(filter: HistoryFilter): void {
    if (filter !== this.filter()) {
      this.navigate({ filter: filter === 'all' ? null : filter, page: 1 });
    }
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  async open(item: UserNotificationItem): Promise<void> {
    if (!item.readAtUtc) {
      const readAtUtc = new Date().toISOString();
      this.items.update((items) => items.map((candidate) => (candidate.id === item.id ? { ...candidate, readAtUtc } : candidate)));
      this.unreadCount.update((count) => Math.max(0, count - 1));
      await this.center.markAsRead(item);
    }

    if (item.url?.startsWith('/')) {
      await this.router.navigateByUrl(item.url);
    }
  }

  async markAllAsRead(): Promise<void> {
    await this.center.markAllAsRead();
    await this.load();
  }

  timeAgo(isoDate: string): string {
    return formatRelativeTime(isoDate, this.now());
  }

  private applyQuery(params: ParamMap): void {
    this.filter.set(readOptionParam(params, 'filter', FILTERS) || 'all');
    this.page.set(readPageParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(patch),
      queryParamsHandling: 'merge',
    });
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const result = await firstValueFrom(this.api.getHistory(this.page(), this.pageSize, this.filter() === 'unread'));
      if (sequence !== this.loadSequence) {
        return;
      }

      this.now.set(Date.now());
      this.items.set(result.items);
      this.totalCount.set(result.totalCount);
      this.unreadCount.set(result.unreadCount);
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.errorMessage.set(getApiErrorMessage(error, 'No pudimos cargar tus notificaciones. Intenta de nuevo.'));
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
