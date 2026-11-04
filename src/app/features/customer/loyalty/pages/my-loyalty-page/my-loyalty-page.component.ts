import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { LOYALTY_POSITIVE_MOVEMENTS, MyLoyaltyView, loyaltyMovementLabel } from '../../../../../core/models/loyalty-wallet.models';
import { LoyaltyWalletApiService } from '../../../../../core/services/loyalty-wallet-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

/** "Mis puntos": the signed-in customer's own balance, upcoming expirations and history. */
@Component({
  selector: 'app-my-loyalty-page',
  imports: [DatePipe, RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './my-loyalty-page.component.html',
  styleUrl: '../../../memberships/my-memberships.scss',
})
export class MyLoyaltyPageComponent implements OnInit {
  private readonly walletApi = inject(LoyaltyWalletApiService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly view = signal<MyLoyaltyView | null>(null);

  readonly movementLabel = loyaltyMovementLabel;
  readonly isPositive = (type: string) => LOYALTY_POSITIVE_MOVEMENTS.has(type);

  async ngOnInit(): Promise<void> {
    try {
      this.view.set(await firstValueFrom(this.walletApi.getMine()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
