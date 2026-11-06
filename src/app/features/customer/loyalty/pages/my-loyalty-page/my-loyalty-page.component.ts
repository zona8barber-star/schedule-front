import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  MyLoyaltyCatalogView,
  MyLoyaltyRedemptionView,
  MyLoyaltyRewardView,
  newIdempotencyKey,
  redemptionStatusLabel,
} from '../../../../../core/models/loyalty-redemption.models';
import { MyLoyaltyView, loyaltyMovementLabel, loyaltyMovementSign } from '../../../../../core/models/loyalty-wallet.models';
import { LoyaltyRedemptionApiService } from '../../../../../core/services/loyalty-redemption-api.service';
import { LoyaltyWalletApiService } from '../../../../../core/services/loyalty-wallet-api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

/**
 * "Mis puntos": the signed-in customer's own balance, reserved points, upcoming expirations, rewards to redeem, own
 * redemptions (cancellable until delivered) and history.
 */
@Component({
  selector: 'app-my-loyalty-page',
  imports: [DatePipe, RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './my-loyalty-page.component.html',
  styleUrl: '../../../memberships/my-memberships.scss',
})
export class MyLoyaltyPageComponent implements OnInit {
  private readonly walletApi = inject(LoyaltyWalletApiService);
  private readonly redemptionApi = inject(LoyaltyRedemptionApiService);
  private readonly toastService = inject(ToastService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly view = signal<MyLoyaltyView | null>(null);
  readonly catalog = signal<MyLoyaltyCatalogView | null>(null);
  readonly redemptions = signal<MyLoyaltyRedemptionView[]>([]);
  /** The reward waiting for the customer's confirmation, and the one being sent. */
  readonly confirming = signal<MyLoyaltyRewardView | null>(null);
  readonly busyId = signal<string | null>(null);

  readonly movementLabel = loyaltyMovementLabel;
  readonly statusLabel = redemptionStatusLabel;
  readonly movementSign = loyaltyMovementSign;

  /** Kept across retries of the same request; renewed after a success or when choosing another reward. */
  private requestKey = newIdempotencyKey();

  async ngOnInit(): Promise<void> {
    try {
      await this.loadAll();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
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
    const [view, catalog, redemptions] = await Promise.all([
      firstValueFrom(this.walletApi.getMine()),
      firstValueFrom(this.redemptionApi.getMyCatalog()),
      firstValueFrom(this.redemptionApi.getMyRedemptions()),
    ]);
    this.view.set(view);
    this.catalog.set(catalog);
    this.redemptions.set(redemptions);
  }
}
