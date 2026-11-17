import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  InventoryAdjustmentRequest,
  InventoryItemView,
  InventoryListQuery,
  InventoryMovementListQuery,
  InventoryMovementResultView,
  InventoryMovementView,
  InventoryReceiptRequest,
  InventorySalesView,
  InventorySummaryView,
} from '../models/inventory.models';
import { PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

/**
 * Product inventory (ADR-0020, stage 1). Reading needs Admin or any inventory permission; receipts and the minimum stock
 * need inventory.receive; adjustments need inventory.adjust (checked against the database on every request).
 */
@Injectable({
  providedIn: 'root',
})
export class AdminInventoryApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list(query: InventoryListQuery = {}) {
    const params = toHttpParams({
      q: query.q,
      lowStock: query.lowStock ? true : null,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.httpClient.get<PagedResult<InventoryItemView>>(this.buildUrl('/admin/inventory'), { params });
  }

  summary() {
    return this.httpClient.get<InventorySummaryView>(this.buildUrl('/admin/inventory/summary'));
  }

  /** ADR-0020 stage 3: units sold, revenue, cost and profit by product from approved bills (at most 30 days). */
  sales(from: string | null, to: string | null) {
    return this.httpClient.get<InventorySalesView>(this.buildUrl('/admin/inventory/sales'), { params: toHttpParams({ from, to }) });
  }

  get(productId: string) {
    return this.httpClient.get<InventoryItemView>(this.buildUrl(`/admin/inventory/${productId}`));
  }

  movements(productId: string, query: InventoryMovementListQuery = {}) {
    const params = toHttpParams({ type: query.type, page: query.page, pageSize: query.pageSize });
    return this.httpClient.get<PagedResult<InventoryMovementView>>(
      this.buildUrl(`/admin/inventory/${productId}/movements`),
      { params },
    );
  }

  receive(productId: string, request: InventoryReceiptRequest) {
    return this.httpClient.post<InventoryMovementResultView>(this.buildUrl(`/admin/inventory/${productId}/receipts`), request);
  }

  adjust(productId: string, request: InventoryAdjustmentRequest) {
    return this.httpClient.post<InventoryMovementResultView>(
      this.buildUrl(`/admin/inventory/${productId}/adjustments`),
      request,
    );
  }

  setMinStock(productId: string, minStock: number | null) {
    return this.httpClient.put<InventoryItemView>(this.buildUrl(`/admin/inventory/${productId}/min-stock`), { minStock });
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
