import { DatePipe } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PERMISSION_CODES } from '../../../../../core/models/auth.models';
import { LoyaltyRewardView, newIdempotencyKey, redemptionStatusLabel } from '../../../../../core/models/loyalty-redemption.models';
import {
  LoyaltyAdjustmentDirection,
  LoyaltyWalletView,
  loyaltyMovementLabel,
  loyaltyMovementSign,
} from '../../../../../core/models/loyalty-wallet.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { LoyaltyRedemptionApiService } from '../../../../../core/services/loyalty-redemption-api.service';
import { LoyaltyWalletApiService } from '../../../../../core/services/loyalty-wallet-api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

/**
 * A customer's points: balance, reserved points, debt, lots with their expiry, redemptions, history and, with
 * loyalty.points.adjust, manual credits and debits (a debit never goes beyond the available points). With
 * loyalty.redemptions.approve, a redemption can be registered at the counter for a customer verified in person.
 */
@Component({
  selector: 'app-admin-customer-loyalty-panel',
  imports: [DatePipe, FormsModule, ApiFeedbackComponent],
  templateUrl: './admin-customer-loyalty-panel.component.html',
  styleUrl: './admin-customer-loyalty-panel.component.scss',
})
export class AdminCustomerLoyaltyPanelComponent implements OnInit {
  private readonly walletApi = inject(LoyaltyWalletApiService);
  private readonly redemptionApi = inject(LoyaltyRedemptionApiService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  @Input({ required: true }) customerId!: string;

  readonly wallet = signal<LoyaltyWalletView | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly adjustError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly showHistory = signal(false);
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
  }

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
    } catch (error) {
      this.adjustError.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }
}
