import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { UserNotificationItem } from '../../../../../core/models/notification.models';
import { NotificationCenterService } from '../../../../../core/services/notification-center.service';
import { NotificationsApiService } from '../../../../../core/services/notifications-api.service';
import { QueryValue, readOptionParam, readPageParam, toQueryParams } from '../../../../../core/utils/list-query.utils';
import { formatRelativeTime } from '../../../../../core/utils/relative-time.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { LoadErrorComponent } from '../../../../../shared/components/load-error/load-error.component';
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
  imports: [RouterLink, ApiFeedbackComponent, LoadErrorComponent, PageStateComponent, PaginatorComponent, BogotaDatePipe],
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
  /** SONDA BUG-143: the history could not be loaded; never shown as «No tienes notificaciones todavía» nor «(0)». */
  readonly loadError = signal<unknown>(null);
  readonly loaded = signal(false);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  private readonly now = signal(Date.now());

  /** SONDA BUG-148: «Marcar todas como leídas» from the bell refreshes the history that is open. */
  private seenReadAll = this.center.readAllVersion?.() ?? 0;
  private readonly readAllEffect = effect(() => {
    const version = this.center.readAllVersion?.() ?? 0;
    untracked(() => {
      if (version > this.seenReadAll) {
        this.seenReadAll = version;
        void this.load();
      }
    });
  });

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

  retryLoad(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.loadError.set(null);

    try {
      const result = await firstValueFrom(this.api.getHistory(this.page(), this.pageSize, this.filter() === 'unread'));
      if (sequence !== this.loadSequence) {
        return;
      }

      this.now.set(Date.now());
      this.items.set(result.items);
      this.totalCount.set(result.totalCount);
      this.unreadCount.set(result.unreadCount);
      this.loaded.set(true);
      // SONDA BUG-144: a page past the end (?page=999) goes to the last page instead of claiming there are none.
      if (!result.items.length && result.totalCount > 0 && this.page() > 1) {
        this.navigate({ page: Math.max(1, Math.ceil(result.totalCount / this.pageSize)) });
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.items.set([]);
        this.loadError.set(error);
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
