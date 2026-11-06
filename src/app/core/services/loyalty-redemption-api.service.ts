import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  LoyaltyCounterRedemptionRequest,
  LoyaltyRedemptionView,
  LoyaltyRewardChangeView,
  LoyaltyRewardServiceOption,
  LoyaltyRewardUpsertRequest,
  LoyaltyRewardView,
  MyLoyaltyCatalogView,
  MyLoyaltyRedemptionView,
} from '../models/loyalty-redemption.models';

/**
 * Rewards and redemptions (ADR-0015). The catalog needs loyalty.rewards.manage; approving, rejecting, cancelling and
 * counter requests need loyalty.redemptions.approve; deliveries need loyalty.redemptions.deliver. The two redemption
 * permissions are critical: the API checks them against the database on every request.
 */
@Injectable({
  providedIn: 'root',
})
export class LoyaltyRedemptionApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  // ── Customer ────────────────────────────────────────────────────────────────────────────────

  getMyCatalog() {
    return this.httpClient.get<MyLoyaltyCatalogView>(this.buildUrl('/customer/loyalty/rewards'));
  }

  getMyRedemptions() {
    return this.httpClient.get<MyLoyaltyRedemptionView[]>(this.buildUrl('/customer/loyalty/redemptions'));
  }

  request(rewardId: string, idempotencyKey: string) {
    return this.httpClient.post<MyLoyaltyRedemptionView>(this.buildUrl('/customer/loyalty/redemptions'), {
      rewardId,
      idempotencyKey,
    });
  }

  cancelMine(redemptionId: string, reason: string | null) {
    return this.httpClient.post<MyLoyaltyRedemptionView>(
      this.buildUrl(`/customer/loyalty/redemptions/${redemptionId}/cancel`),
      { reason },
    );
  }

  // ── Catalog ─────────────────────────────────────────────────────────────────────────────────

  getRewards() {
    return this.httpClient.get<LoyaltyRewardView[]>(this.buildUrl('/admin/loyalty/rewards'));
  }

  getRewardServiceOptions() {
    return this.httpClient.get<LoyaltyRewardServiceOption[]>(this.buildUrl('/admin/loyalty/rewards/service-options'));
  }

  createReward(request: LoyaltyRewardUpsertRequest) {
    return this.httpClient.post<LoyaltyRewardView>(this.buildUrl('/admin/loyalty/rewards'), request);
  }

  updateReward(rewardId: string, request: LoyaltyRewardUpsertRequest) {
    return this.httpClient.put<LoyaltyRewardView>(this.buildUrl(`/admin/loyalty/rewards/${rewardId}`), request);
  }

  getRewardChanges(rewardId: string) {
    return this.httpClient.get<LoyaltyRewardChangeView[]>(this.buildUrl(`/admin/loyalty/rewards/${rewardId}/changes`));
  }

  // ── Redemptions ─────────────────────────────────────────────────────────────────────────────

  getRedemptions(status: string | null, customerId: string | null = null) {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }

    if (customerId) {
      params = params.set('customerId', customerId);
    }

    return this.httpClient.get<LoyaltyRedemptionView[]>(this.buildUrl('/admin/loyalty/redemptions'), { params });
  }

  /** Active rewards for a counter request (needs loyalty.redemptions.approve, not the catalog permission). */
  getActiveRewardsForCounter() {
    return this.httpClient.get<LoyaltyRewardView[]>(this.buildUrl('/admin/loyalty/redemptions/rewards'));
  }

  getDeliveries() {
    return this.httpClient.get<LoyaltyRedemptionView[]>(this.buildUrl('/admin/loyalty/redemptions/deliveries'));
  }

  approve(redemptionId: string, version: number) {
    return this.httpClient.post<LoyaltyRedemptionView>(
      this.buildUrl(`/admin/loyalty/redemptions/${redemptionId}/approve`),
      { version },
    );
  }

  reject(redemptionId: string, version: number, reason: string) {
    return this.httpClient.post<LoyaltyRedemptionView>(
      this.buildUrl(`/admin/loyalty/redemptions/${redemptionId}/reject`),
      { version, reason },
    );
  }

  cancel(redemptionId: string, version: number, reason: string) {
    return this.httpClient.post<LoyaltyRedemptionView>(
      this.buildUrl(`/admin/loyalty/redemptions/${redemptionId}/cancel`),
      { version, reason },
    );
  }

  /** Only rewards of kind 'Other'; a service reward is delivered by confirming its service record. */
  deliver(redemptionId: string, version: number) {
    return this.httpClient.post<LoyaltyRedemptionView>(
      this.buildUrl(`/admin/loyalty/redemptions/${redemptionId}/deliver`),
      { version },
    );
  }

  createAtCounter(customerId: string, request: LoyaltyCounterRedemptionRequest) {
    return this.httpClient.post<LoyaltyRedemptionView>(
      this.buildUrl(`/admin/loyalty/redemptions/customers/${customerId}`),
      request,
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
