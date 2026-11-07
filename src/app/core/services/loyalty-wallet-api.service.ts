import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  LoyaltyAdjustmentRequest,
  LoyaltyMovementListQuery,
  LoyaltyMovementView,
  LoyaltyWalletView,
  MyLoyaltyMovementView,
  MyLoyaltyView,
} from '../models/loyalty-wallet.models';
import { PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

/**
 * Points wallet: the customer's own points and, for admins, a customer's wallet and manual adjustments. The wallet
 * views only embed the latest movements; the full history is the paginated movement list (ADR-0016 B7).
 */
@Injectable({
  providedIn: 'root',
})
export class LoyaltyWalletApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getMine() {
    return this.httpClient.get<MyLoyaltyView>(this.buildUrl('/customer/loyalty'));
  }

  getMyMovements(query: LoyaltyMovementListQuery = {}) {
    return this.httpClient.get<PagedResult<MyLoyaltyMovementView>>(this.buildUrl('/customer/loyalty/movements'), {
      params: movementParams(query),
    });
  }

  getCustomerWallet(customerId: string) {
    return this.httpClient.get<LoyaltyWalletView>(this.buildUrl(`/admin/customers/${customerId}/loyalty`));
  }

  getCustomerMovements(customerId: string, query: LoyaltyMovementListQuery = {}) {
    return this.httpClient.get<PagedResult<LoyaltyMovementView>>(
      this.buildUrl(`/admin/customers/${customerId}/loyalty/movements`),
      { params: movementParams(query) },
    );
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

function movementParams(query: LoyaltyMovementListQuery) {
  return toHttpParams({
    from: query.from,
    to: query.to,
    type: query.type,
    page: query.page,
    pageSize: query.pageSize,
  });
}
