import { BogotaDatePipe } from '../../../../../shared/pipes/bogota-date.pipe';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  MyLoyaltyCatalogView,
  MyLoyaltyRedemptionView,
  MyLoyaltyRewardView,
  newIdempotencyKey,
  redemptionStatusLabel,
} from '../../../../../core/models/loyalty-redemption.models';
import {
  LOYALTY_MOVEMENT_LABELS,
  MyLoyaltyMovementView,
  MyLoyaltyView,
  loyaltyMovementLabel,
  loyaltyMovementSign,
} from '../../../../../core/models/loyalty-wallet.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { LoyaltyRedemptionApiService } from '../../../../../core/services/loyalty-redemption-api.service';
import { LoyaltyWalletApiService } from '../../../../../core/services/loyalty-wallet-api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { QueryValue, readDateParam, readPageParam, readTextParam } from '../../../../../core/utils/list-query.utils';
import {
  HISTORY_RANGE_HINT,
  HistoryRange,
  historyRangeError,
  rangeWithFrom,
  rangeWithTo,
  resolveHistoryRange,
} from '../../../../../core/utils/history-range.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';

/**
 * "Mis puntos": the signed-in customer's own balance, reserved points, upcoming expirations, rewards to redeem, own
 * redemptions (cancellable until delivered) and history. The wallet only brings the latest movements; the full history
 * is paginated on the server with type and date filters kept in the URL (ADR-0016 B7).
 */
import { SingleFlight } from '../../../../../core/utils/single-flight';

@Component({
  selector: 'app-my-loyalty-page',
  imports: [BogotaDatePipe, DatePipe, RouterLink, ApiFeedbackComponent, PageStateComponent, PaginatorComponent],
  templateUrl: './my-loyalty-page.component.html',
  styleUrl: '../../../memberships/my-memberships.scss',
})
export class MyLoyaltyPageComponent implements OnInit {
  private readonly walletApi = inject(LoyaltyWalletApiService);
  private readonly redemptionApi = inject(LoyaltyRedemptionApiService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private historySequence = 0;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly view = signal<MyLoyaltyView | null>(null);
  readonly catalog = signal<MyLoyaltyCatalogView | null>(null);
  readonly redemptions = signal<MyLoyaltyRedemptionView[]>([]);
  /** Own redemptions are paginated on the server: pending ones first, so none is pushed off the first page. */
  readonly redemptionsTotal = signal(0);
  readonly redemptionsPage = signal(1);
  readonly redemptionsPageSize = DEFAULT_PAGE_SIZE;
  readonly redemptionsLoading = signal(false);
  /** The reward waiting for the customer's confirmation, and the one being sent. */
  readonly confirming = signal<MyLoyaltyRewardView | null>(null);
  readonly busyId = signal<string | null>(null);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly showHistory = signal(false);
  readonly movementTypes = Object.keys(LOYALTY_MOVEMENT_LABELS);
  readonly history = signal<MyLoyaltyMovementView[]>([]);
  readonly historyTotal = signal(0);
  readonly historyPage = signal(1);
  readonly historyPageSize = DEFAULT_PAGE_SIZE;
  readonly historyType = signal('');
  readonly historyFrom = signal('');
  readonly historyTo = signal('');
  readonly rangeHint = HISTORY_RANGE_HINT;
  /** The movement history: the last 30 days by default, at most 30 days per query, any period. */
  readonly historyRange = computed<HistoryRange>(() => resolveHistoryRange(this.historyFrom(), this.historyTo()));
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);

  readonly movementLabel = loyaltyMovementLabel;
  readonly statusLabel = redemptionStatusLabel;
  readonly movementSign = loyaltyMovementSign;

  /** Kept across retries of the same request; renewed after a success or when choosing another reward. */
  private requestKey = newIdempotencyKey();

  async ngOnInit(): Promise<void> {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyHistoryQuery(params);
      if (this.showHistory()) {
        void this.loadHistory();
      }
    });

    try {
      await this.loadAll();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleHistory(): void {
    const show = !this.showHistory();
    this.showHistory.set(show);
    if (show) {
      void this.loadHistory();
    }
  }

  onHistoryFilterChange(patch: Record<string, QueryValue>): void {
    this.navigateHistory({ ...patch, movementPage: null });
  }

  onHistoryFromChange(value: string): void {
    const range = rangeWithFrom(value, this.historyRange());
    this.navigateHistory({ movementFrom: range.from, movementTo: range.to, movementPage: null });
  }

  onHistoryToChange(value: string): void {
    const range = rangeWithTo(value, this.historyRange());
    this.navigateHistory({ movementFrom: range.from, movementTo: range.to, movementPage: null });
  }

  async onRedemptionsPageChange(page: number): Promise<void> {
    this.redemptionsPage.set(page);
    this.redemptionsLoading.set(true);
    try {
      await this.loadRedemptions();
    } catch (error) {
      this.actionError.set(getApiErrorMessage(error));
    } finally {
      this.redemptionsLoading.set(false);
    }
  }

  onHistoryPageChange(page: number): void {
    this.navigateHistory({ movementPage: page > 1 ? page : null });
  }

  async loadHistory(): Promise<void> {
    const sequence = ++this.historySequence;
    const range = this.historyRange();
    this.historyError.set(historyRangeError(range.from, range.to));
    if (this.historyError()) {
      // The API would reject it too (422); explain it instead of asking.
      this.history.set([]);
      this.historyTotal.set(0);
      this.historyLoading.set(false);
      return;
    }
    this.historyLoading.set(true);
    try {
      const result = await firstValueFrom(
        this.walletApi.getMyMovements({
          type: this.historyType() || null,
          from: range.from,
          to: range.to,
          page: this.historyPage(),
          pageSize: this.historyPageSize,
        }),
      );
      if (sequence === this.historySequence) {
        this.history.set(result.items);
        this.historyTotal.set(result.totalCount);
      }
    } catch (error) {
      if (sequence === this.historySequence) {
        this.historyError.set(getApiErrorMessage(error));
      }
    } finally {
      if (sequence === this.historySequence) {
        this.historyLoading.set(false);
      }
    }
  }

  private applyHistoryQuery(params: ParamMap): void {
    this.historyType.set(readTextParam(params, 'movementType'));
    this.historyFrom.set(readDateParam(params, 'movementFrom'));
    this.historyTo.set(readDateParam(params, 'movementTo'));
    this.historyPage.set(readPageParam(params, 'movementPage'));
    // A shared link with history filters opens the history directly.
    if (['movementType', 'movementFrom', 'movementTo', 'movementPage'].some((key) => params.has(key))) {
      this.showHistory.set(true);
    }
  }

  private navigateHistory(patch: Record<string, QueryValue>): void {
    const queryParams: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(patch)) {
      queryParams[key] = value === undefined || value === null || value === '' ? null : String(value);
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  askToRedeem(reward: MyLoyaltyRewardView): void {
    if (this.confirming()?.id !== reward.id) {
      this.requestKey = newIdempotencyKey();
    }

    this.actionError.set(null);
    this.confirming.set(reward);
  }

  dismiss(): void {
    this.confirming.set(null);
  }

  @SingleFlight()
  async redeem(): Promise<void> {
    const reward = this.confirming();
    if (!reward || this.busyId()) {
      return;
    }

    this.busyId.set(reward.id);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.redemptionApi.request(reward.id, this.requestKey));
      this.requestKey = newIdempotencyKey();
      this.confirming.set(null);
      this.toastService.success('Canje solicitado: tus puntos quedan reservados hasta la entrega.');
      await this.loadAll();
    } catch (error) {
      this.actionError.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  async cancel(redemption: MyLoyaltyRedemptionView): Promise<void> {
    if (this.busyId()) {
      return;
    }

    // SONDA BUG-088: cancelling is final (the request has to be made and approved again); ask first.
    const confirmed = await this.confirmModal.confirm({
      title: '¿Cancelar este canje?',
      message: 'Tus puntos vuelven a estar disponibles. Si después quieres la recompensa, tendrás que pedirla de nuevo y esperar otra aprobación.',
      confirmLabel: 'Sí, cancelar canje',
      cancelLabel: 'No, volver',
    });
    if (!confirmed || this.busyId()) {
      return;
    }

    this.busyId.set(redemption.id);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.redemptionApi.cancelMine(redemption.id, null));
      this.toastService.success('Canje cancelado.');
      await this.loadAll();
    } catch (error) {
      this.actionError.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  private async loadAll(): Promise<void> {
    const [view, catalog] = await Promise.all([
      firstValueFrom(this.walletApi.getMine()),
      firstValueFrom(this.redemptionApi.getMyCatalog()),
      this.loadRedemptions(),
    ]);
    this.view.set(view);
    this.catalog.set(catalog);
    if (this.showHistory()) {
      void this.loadHistory();
    }
  }

  private async loadRedemptions(): Promise<void> {
    const result = await firstValueFrom(
      this.redemptionApi.getMyRedemptions({ page: this.redemptionsPage(), pageSize: this.redemptionsPageSize }),
    );
    // A cancellation can leave the last page empty: go back one page.
    if (!result.items.length && result.totalCount > 0 && this.redemptionsPage() > 1) {
      this.redemptionsPage.set(Math.max(1, Math.ceil(result.totalCount / this.redemptionsPageSize)));
      return this.loadRedemptions();
    }
    this.redemptions.set(result.items);
    this.redemptionsTotal.set(result.totalCount);
  }
}
