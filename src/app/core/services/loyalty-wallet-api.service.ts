import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { LoyaltyAdjustmentRequest, LoyaltyWalletView, MyLoyaltyView } from '../models/loyalty-wallet.models';

/** Points wallet: the customer's own points and, for admins, a customer's wallet and manual adjustments. */
@Injectable({
  providedIn: 'root',
})
export class LoyaltyWalletApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getMine() {
    return this.httpClient.get<MyLoyaltyView>(this.buildUrl('/customer/loyalty'));
  }

  getCustomerWallet(customerId: string) {
    return this.httpClient.get<LoyaltyWalletView>(this.buildUrl(`/admin/customers/${customerId}/loyalty`));
  }

  /** Needs loyalty.points.adjust (critical: checked against the database on every request). */
  adjust(customerId: string, request: LoyaltyAdjustmentRequest) {
    return this.httpClient.post<LoyaltyWalletView>(
      this.buildUrl(`/admin/customers/${customerId}/loyalty/adjustments`),
      request,
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
