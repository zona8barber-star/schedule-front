import { BogotaDatePipe } from '../../../../../shared/pipes/bogota-date.pipe';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PERMISSION_CODES } from '../../../../../core/models/auth.models';
import { LoyaltyRewardView, newIdempotencyKey, redemptionStatusLabel } from '../../../../../core/models/loyalty-redemption.models';
import {
  LOYALTY_MOVEMENT_LABELS,
  LoyaltyAdjustmentDirection,
  LoyaltyMovementView,
  LoyaltyWalletView,
  loyaltyMovementLabel,
  loyaltyMovementSign,
} from '../../../../../core/models/loyalty-wallet.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { LoyaltyRedemptionApiService } from '../../../../../core/services/loyalty-redemption-api.service';
import { LoyaltyWalletApiService } from '../../../../../core/services/loyalty-wallet-api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { QueryValue, readDateParam, readPageParam, readTextParam, toQueryParams } from '../../../../../core/utils/list-query.utils';
import {
  HISTORY_RANGE_HINT,
  HistoryRange,
  historyRangeError,
  rangeWithFrom,
  rangeWithTo,
  resolveHistoryRange,
} from '../../../../../core/utils/history-range.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';

/**
 * A customer's points: balance, reserved points, debt, lots with their expiry, redemptions, history and, with
 * loyalty.points.adjust, manual credits and debits (a debit never goes beyond the available points). With
 * loyalty.redemptions.approve, a redemption can be registered at the counter for a customer verified in person.
 */
// The movement history is paginated on the server (ADR-0016 B7); its filters live in the URL as movementType,
// movementFrom, movementTo and movementPage, so they do not clash with the other lists of the customer page.
import { SingleFlight } from '../../../../../core/utils/single-flight';

@Component({
  selector: 'app-admin-customer-loyalty-panel',
  imports: [BogotaDatePipe, DatePipe, FormsModule, RouterLink, ApiFeedbackComponent, PaginatorComponent],
  templateUrl: './admin-customer-loyalty-panel.component.html',
  styleUrl: './admin-customer-loyalty-panel.component.scss',
})
export class AdminCustomerLoyaltyPanelComponent implements OnInit {
  private readonly walletApi = inject(LoyaltyWalletApiService);
  private readonly redemptionApi = inject(LoyaltyRedemptionApiService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private movementsSequence = 0;

  @Input({ required: true }) customerId!: string;

  readonly wallet = signal<LoyaltyWalletView | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly adjustError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly showHistory = signal(false);
  readonly movementTypes = Object.keys(LOYALTY_MOVEMENT_LABELS);
  readonly movements = signal<LoyaltyMovementView[]>([]);
  readonly movementsTotal = signal(0);
  readonly movementsPage = signal(1);
  readonly movementsPageSize = DEFAULT_PAGE_SIZE;
  readonly movementType = signal('');
  readonly movementFrom = signal('');
  readonly movementTo = signal('');
  readonly rangeHint = HISTORY_RANGE_HINT;
  /** The movement history is a history: the last 30 days by default, at most 30 days per query, any period. */
  readonly movementRange = computed<HistoryRange>(() => resolveHistoryRange(this.movementFrom(), this.movementTo()));
  readonly movementsLoading = signal(false);
  readonly movementsError = signal<string | null>(null);
  readonly canAdjust = this.authService.hasPermission(PERMISSION_CODES.loyaltyPointsAdjust);
  readonly canRegisterAtCounter = this.authService.hasPermission(PERMISSION_CODES.loyaltyRedemptionsApprove);
  readonly counterRewards = signal<LoyaltyRewardView[]>([]);
  readonly counterError = signal<string | null>(null);
  readonly isRegistering = signal(false);
  readonly statusLabel = redemptionStatusLabel;

  counterRewardId = '';
  counterVerified = false;
  counterApproveNow = true;
  /** Kept across retries of the same counter request; renewed only after a success. */
  private counterKey = newIdempotencyKey();

  direction: LoyaltyAdjustmentDirection = 'Credit';
  points: number | null = null;
  reason = '';
  /** Kept across retries of the same adjustment; renewed only after a success. */
  private adjustmentKey = crypto.randomUUID();

  readonly movementLabel = loyaltyMovementLabel;
  readonly movementSign = loyaltyMovementSign;

  ngOnInit(): void {
    void this.load();
    if (this.canRegisterAtCounter) {
      void this.loadCounterRewards();
    }

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyMovementQuery(params);
      if (this.showHistory()) {
        void this.loadMovements();
      }
    });
  }

  toggleHistory(): void {
    const show = !this.showHistory();
    this.showHistory.set(show);
    if (show) {
      void this.loadMovements();
    }
  }

  onMovementTypeChange(type: string): void {
    this.navigateMovements({ movementType: type, movementPage: 1 });
  }

  onMovementFromChange(date: string): void {
    const range = rangeWithFrom(date, this.movementRange());
    this.navigateMovements({ movementFrom: range.from, movementTo: range.to, movementPage: 1 });
  }

  onMovementToChange(date: string): void {
    const range = rangeWithTo(date, this.movementRange());
    this.navigateMovements({ movementFrom: range.from, movementTo: range.to, movementPage: 1 });
  }

  onMovementsPageChange(page: number): void {
    this.navigateMovements({ movementPage: page });
  }

  async loadMovements(): Promise<void> {
    const sequence = ++this.movementsSequence;
    const range = this.movementRange();
    this.movementsError.set(historyRangeError(range.from, range.to));
    if (this.movementsError()) {
      // The API would reject it too (422); explain it instead of asking.
      this.movements.set([]);
      this.movementsTotal.set(0);
      this.movementsLoading.set(false);
      return;
    }
    this.movementsLoading.set(true);
    try {
      const result = await firstValueFrom(
        this.walletApi.getCustomerMovements(this.customerId, {
          type: this.movementType() || null,
          from: range.from,
          to: range.to,
          page: this.movementsPage(),
          pageSize: this.movementsPageSize,
        }),
      );
      if (sequence === this.movementsSequence) {
        this.movements.set(result.items);
        this.movementsTotal.set(result.totalCount);
      }
    } catch (error) {
      if (sequence === this.movementsSequence) {
        this.movementsError.set(getApiErrorMessage(error));
      }
    } finally {
      if (sequence === this.movementsSequence) {
        this.movementsLoading.set(false);
      }
    }
  }

  private applyMovementQuery(params: ParamMap): void {
    this.movementType.set(readTextParam(params, 'movementType'));
    this.movementFrom.set(readDateParam(params, 'movementFrom'));
    this.movementTo.set(readDateParam(params, 'movementTo'));
    this.movementsPage.set(readPageParam(params, 'movementPage'));
    // A shared link with movement filters opens the history directly.
    if (params.has('movementType') || params.has('movementFrom') || params.has('movementTo') || params.has('movementPage')) {
      this.showHistory.set(true);
    }
  }

  private navigateMovements(patch: Record<string, QueryValue>): void {
    const params = toQueryParams(patch);
    // toQueryParams only knows the default "page" key.
    if (patch['movementPage'] === 1) {
      params['movementPage'] = null;
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge' });
  }

  @SingleFlight()
  async registerAtCounter(): Promise<void> {
    if (this.isRegistering()) {
      return;
    }

    this.counterError.set(null);
    if (!this.counterRewardId) {
      this.counterError.set('Elige la recompensa.');
      return;
    }

    if (!this.counterVerified) {
      this.counterError.set('Confirma que verificaste en persona la identidad del cliente.');
      return;
    }

    this.isRegistering.set(true);
    try {
      await firstValueFrom(
        this.redemptionApi.createAtCounter(this.customerId, {
          rewardId: this.counterRewardId,
          inPersonVerified: this.counterVerified,
          approveNow: this.counterApproveNow,
          idempotencyKey: this.counterKey,
        }),
      );
      this.counterKey = newIdempotencyKey();
      this.counterRewardId = '';
      this.counterVerified = false;
      this.toastService.success('Canje registrado.');
      await this.load();
      if (this.showHistory()) {
        await this.loadMovements();
      }
    } catch (error) {
      this.counterError.set(getApiErrorMessage(error));
    } finally {
      this.isRegistering.set(false);
    }
  }

  private async loadCounterRewards(): Promise<void> {
    try {
      this.counterRewards.set(await firstValueFrom(this.redemptionApi.getActiveRewardsForCounter()));
    } catch {
      // Without the list the counter form stays empty; the rest of the panel works.
      this.counterRewards.set([]);
    }
  }

  async load(): Promise<void> {
    this.errorMessage.set(null);
    try {
      this.wallet.set(await firstValueFrom(this.walletApi.getCustomerWallet(this.customerId)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    }
  }

  async adjust(): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.adjustError.set(null);
    try {
      const wallet = await firstValueFrom(
        this.walletApi.adjust(this.customerId, {
          direction: this.direction,
          points: Number(this.points ?? 0),
          reason: this.reason.trim(),
          idempotencyKey: this.adjustmentKey,
        }),
      );
      this.wallet.set(wallet);
      this.adjustmentKey = crypto.randomUUID();
      this.points = null;
      this.reason = '';
      this.toastService.success('Ajuste de puntos registrado.');
      if (this.showHistory()) {
        void this.loadMovements();
      }
    } catch (error) {
      this.adjustError.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }
}
