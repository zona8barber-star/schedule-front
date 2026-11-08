import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  LoyaltyCounterRedemptionRequest,
  LoyaltyRedemptionListQuery,
  LoyaltyRedemptionView,
  LoyaltyRewardChangeView,
  LoyaltyRewardServiceOption,
  LoyaltyRewardUpsertRequest,
  LoyaltyRewardView,
  MyLoyaltyCatalogView,
  MyLoyaltyRedemptionView,
} from '../models/loyalty-redemption.models';
import { PageQuery, PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

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

  /** Own redemptions, paginated: pending ones first, then newest request first. */
  getMyRedemptions(query: PageQuery = {}) {
    return this.httpClient.get<PagedResult<MyLoyaltyRedemptionView>>(this.buildUrl('/customer/loyalty/redemptions'), {
      params: toHttpParams({ page: query.page, pageSize: query.pageSize }),
    });
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

  /** Paginated, newest first. */
  getRewardChanges(rewardId: string, query: PageQuery = {}) {
    return this.httpClient.get<PagedResult<LoyaltyRewardChangeView>>(
      this.buildUrl(`/admin/loyalty/rewards/${rewardId}/changes`),
      { params: toHttpParams({ page: query.page, pageSize: query.pageSize }) },
    );
  }

  // ── Redemptions ─────────────────────────────────────────────────────────────────────────────

  /** Paginated (ADR-0016 B7): a pending status lists oldest first, any other view newest first. */
  getRedemptions(query: LoyaltyRedemptionListQuery = {}) {
    const params = toHttpParams({
      status: query.status,
      customerId: query.customerId,
      from: query.from,
      to: query.to,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.httpClient.get<PagedResult<LoyaltyRedemptionView>>(this.buildUrl('/admin/loyalty/redemptions'), { params });
  }

  /** Active rewards for a counter request (needs loyalty.redemptions.approve, not the catalog permission). */
  getActiveRewardsForCounter() {
    return this.httpClient.get<LoyaltyRewardView[]>(this.buildUrl('/admin/loyalty/redemptions/rewards'));
  }

  /** Approved redemptions waiting for delivery, oldest deadline first; paginated, never filtered by date. */
  getDeliveries(query: PageQuery = {}) {
    return this.httpClient.get<PagedResult<LoyaltyRedemptionView>>(this.buildUrl('/admin/loyalty/redemptions/deliveries'), {
      params: toHttpParams({ page: query.page, pageSize: query.pageSize }),
    });
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
