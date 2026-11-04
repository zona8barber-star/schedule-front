import { DatePipe } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PERMISSION_CODES } from '../../../../../core/models/auth.models';
import {
  LOYALTY_POSITIVE_MOVEMENTS,
  LoyaltyAdjustmentDirection,
  LoyaltyWalletView,
  loyaltyMovementLabel,
} from '../../../../../core/models/loyalty-wallet.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { LoyaltyWalletApiService } from '../../../../../core/services/loyalty-wallet-api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

/**
 * A customer's points: balance, debt, lots with their expiry, history and, with loyalty.points.adjust, manual
 * credits and debits (a debit never goes beyond the available points).
 */
@Component({
  selector: 'app-admin-customer-loyalty-panel',
  imports: [DatePipe, FormsModule, ApiFeedbackComponent],
  templateUrl: './admin-customer-loyalty-panel.component.html',
  styleUrl: './admin-customer-loyalty-panel.component.scss',
})
export class AdminCustomerLoyaltyPanelComponent implements OnInit {
  private readonly walletApi = inject(LoyaltyWalletApiService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  @Input({ required: true }) customerId!: string;

  readonly wallet = signal<LoyaltyWalletView | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly adjustError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly showHistory = signal(false);
  readonly canAdjust = this.authService.hasPermission(PERMISSION_CODES.loyaltyPointsAdjust);

  direction: LoyaltyAdjustmentDirection = 'Credit';
  points: number | null = null;
  reason = '';
  /** Kept across retries of the same adjustment; renewed only after a success. */
  private adjustmentKey = crypto.randomUUID();

  readonly movementLabel = loyaltyMovementLabel;
  readonly isPositive = (type: string) => LOYALTY_POSITIVE_MOVEMENTS.has(type);

  ngOnInit(): void {
    void this.load();
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
