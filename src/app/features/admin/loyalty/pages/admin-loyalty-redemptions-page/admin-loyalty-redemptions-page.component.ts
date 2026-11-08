import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';

import { PERMISSION_CODES } from '../../../../../core/models/auth.models';
import {
  LOYALTY_REWARD_KIND_LABELS,
  LoyaltyRedemptionStatus,
  LoyaltyRedemptionView,
  redemptionStatusLabel,
} from '../../../../../core/models/loyalty-redemption.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { LoyaltyRedemptionApiService } from '../../../../../core/services/loyalty-redemption-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readDateParam,
  readOptionParam,
  readPageParam,
  readPageSizeParam,
  readTextParam,
  toQueryParams,
} from '../../../../../core/utils/list-query.utils';
import {
  HISTORY_RANGE_HINT,
  HistoryRange,
  historyRangeError,
  rangeWithFrom,
  rangeWithTo,
  resolveHistoryRange,
  resolveOptionalRange,
} from '../../../../../core/utils/history-range.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';

type RedemptionTab = 'Requested' | 'Deliveries' | 'History';

const REDEMPTION_STATUSES: readonly LoyaltyRedemptionStatus[] = [
  'Requested',
  'Approved',
  'Delivered',
  'Rejected',
  'Cancelled',
  'Expired',
];

/**
 * Redemption inbox (ADR-0015): approve or reject requests (loyalty.redemptions.approve), deliver approved "other"
 * rewards (loyalty.redemptions.deliver) and cancel pending ones. Service rewards are delivered only by confirming
 * the service record. Both permissions are critical and checked by the API on every request.
 */
// ADR-0016 B7: every tab is paginated on the server and keeps its filters in the URL. "Por aprobar" and "Por entregar"
// are work queues: no default dates, so an old pending redemption is never hidden. "Historial" is a history: the last
// 30 days by default and at most 30 days per query (a pending status chosen there behaves like a queue).
@Component({
  selector: 'app-admin-loyalty-redemptions-page',
  imports: [DatePipe, FormsModule, ApiFeedbackComponent, PageStateComponent, PaginatorComponent],
  templateUrl: './admin-loyalty-redemptions-page.component.html',
  styleUrls: [
    '../../../service-records/pages/admin-service-records-page/admin-service-records-page.component.scss',
    './admin-loyalty-redemptions-page.component.scss',
  ],
})
export class AdminLoyaltyRedemptionsPageComponent implements OnInit {
  private readonly api = inject(LoyaltyRedemptionApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly canApprove = this.authService.hasPermission(PERMISSION_CODES.loyaltyRedemptionsApprove);
  readonly canDeliver = this.authService.hasPermission(PERMISSION_CODES.loyaltyRedemptionsDeliver);
  readonly tabs: { id: RedemptionTab; label: string }[] = [
    ...(this.canApprove ? [{ id: 'Requested' as const, label: 'Por aprobar' }] : []),
    ...(this.canDeliver ? [{ id: 'Deliveries' as const, label: 'Por entregar' }] : []),
    ...(this.canApprove ? [{ id: 'History' as const, label: 'Historial' }] : []),
  ];

  readonly tab = signal<RedemptionTab>(this.tabs[0]?.id ?? 'Requested');
  readonly redemptions = signal<LoyaltyRedemptionView[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly statuses = REDEMPTION_STATUSES;
  readonly statusFilter = signal<LoyaltyRedemptionStatus | ''>('');
  readonly customerId = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly rangeHint = HISTORY_RANGE_HINT;
  /** True when the current view is a history (dates default to the last 30 days); false for the work queues. */
  readonly isHistoryView = computed(
    () => this.tab() === 'History' && this.statusFilter() !== 'Requested' && this.statusFilter() !== 'Approved',
  );
  readonly range = computed<HistoryRange | null>(() =>
    this.isHistoryView()
      ? resolveHistoryRange(this.fromDate(), this.toDate())
      : resolveOptionalRange(this.fromDate(), this.toDate()),
  );
  readonly rangeError = computed(() => {
    const range = this.range();
    return range ? historyRangeError(range.from, range.to) : null;
  });
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);
  /** A rejection or cancellation waiting for its reason. */
  readonly acting = signal<{ id: string; action: 'reject' | 'cancel' } | null>(null);
  reason = '';

  readonly statusLabel = redemptionStatusLabel;
  readonly kindLabels = LOYALTY_REWARD_KIND_LABELS;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  /** Date and customer filters apply to the request queue and the history; deliveries are a plain paginated queue. */
  get hasFilters(): boolean {
    return this.tab() !== 'Deliveries';
  }

  onFromChange(value: string): void {
    this.navigate({ ...rangeWithFrom(value, this.range() ?? { from: '', to: '' }), page: 1 });
  }

  onToChange(value: string): void {
    this.navigate({ ...rangeWithTo(value, this.range() ?? { from: '', to: '' }), page: 1 });
  }

  clearDates(): void {
    this.navigate({ from: null, to: null, page: 1 });
  }

  selectTab(tab: RedemptionTab): void {
    this.acting.set(null);
    this.navigate({ tab: tab === this.tabs[0]?.id ? null : tab, status: null, from: null, to: null, page: 1 });
  }

  onFilterChange(patch: Record<string, QueryValue>): void {
    this.navigate({ ...patch, page: 1 });
  }

  clearCustomer(): void {
    this.navigate({ customerId: null, page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  private applyQuery(params: ParamMap): void {
    const allowed = this.tabs.map((item) => item.id);
    this.tab.set(readOptionParam(params, 'tab', allowed) || (allowed[0] ?? 'Requested'));
    this.statusFilter.set(readOptionParam(params, 'status', REDEMPTION_STATUSES));
    this.customerId.set(readTextParam(params, 'customerId'));
    this.fromDate.set(readDateParam(params, 'from'));
    this.toDate.set(readDateParam(params, 'to'));
    this.page.set(readPageParam(params));
    this.pageSize.set(readPageSizeParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(patch), queryParamsHandling: 'merge' });
  }

  startReason(redemption: LoyaltyRedemptionView, action: 'reject' | 'cancel'): void {
    this.reason = '';
    this.errorMessage.set(null);
    this.acting.set({ id: redemption.id, action });
  }

  async approve(redemption: LoyaltyRedemptionView): Promise<void> {
    await this.run(redemption, () => this.api.approve(redemption.id, redemption.version), 'Canje aprobado.');
  }

  async deliver(redemption: LoyaltyRedemptionView): Promise<void> {
    await this.run(redemption, () => this.api.deliver(redemption.id, redemption.version), 'Canje entregado.');
  }

  async confirmReason(redemption: LoyaltyRedemptionView): Promise<void> {
    const acting = this.acting();
    const reason = this.reason.trim();
    if (!acting || acting.id !== redemption.id) {
      return;
    }

    if (reason.length < 3) {
      this.errorMessage.set('Escribe el motivo (al menos 3 caracteres).');
      return;
    }

    await this.run(
      redemption,
      () =>
        acting.action === 'reject'
          ? this.api.reject(redemption.id, redemption.version, reason)
          : this.api.cancel(redemption.id, redemption.version, reason),
      acting.action === 'reject' ? 'Canje rechazado; sus puntos se liberaron.' : 'Canje cancelado; sus puntos se liberaron.',
    );
  }

  private async run(redemption: LoyaltyRedemptionView, action: () => Observable<LoyaltyRedemptionView>, message: string): Promise<void> {
    if (this.busyId()) {
      return;
    }

    this.busyId.set(redemption.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      await firstValueFrom(action());
      this.acting.set(null);
      this.successMessage.set(message);
      await this.load();
    } catch (error) {
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 403
          ? 'Ya no tienes permiso para esta acción. Si crees que es un error, pide a un administrador que revise tu rol.'
          : getApiErrorMessage(error),
      );
      if (error instanceof HttpErrorResponse && error.status === 409) {
        await this.load(false);
      }
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(clearMessages = true): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    if (clearMessages) {
      this.errorMessage.set(null);
    }

    const tab = this.tab();
    if (tab !== 'Deliveries' && this.rangeError()) {
      // The API would reject it too (422); the message next to the dates explains why.
      this.redemptions.set([]);
      this.totalCount.set(0);
      this.isLoading.set(false);
      return;
    }

    try {
      if (tab === 'Deliveries') {
        const deliveries = await firstValueFrom(this.api.getDeliveries({ page: this.page(), pageSize: this.pageSize() }));
        if (sequence === this.loadSequence) {
          this.redemptions.set(deliveries.items);
          this.totalCount.set(deliveries.totalCount);
        }
      } else {
        const range = this.range();
        const result = await firstValueFrom(
          this.api.getRedemptions({
            status: tab === 'Requested' ? 'Requested' : this.statusFilter() || null,
            customerId: this.customerId() || null,
            from: range?.from ?? null,
            to: range?.to ?? null,
            page: this.page(),
            pageSize: this.pageSize(),
          }),
        );
        if (sequence === this.loadSequence) {
          this.redemptions.set(result.items);
          this.totalCount.set(result.totalCount);
        }
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.redemptions.set([]);
        this.totalCount.set(0);
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
