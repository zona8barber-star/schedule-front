import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { MyBillSummaryView, MyBillView } from '../models/bill.models';
import { PageQuery, PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

/** «Mis recibos de caja» (ADR-0020 stage 5): read only; the server resolves the owner from the signed-in account. */
@Injectable({
  providedIn: 'root',
})
export class CustomerBillsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  /** Own receipts, newest first, with those of the profiles merged into the own one. */
  list(query: PageQuery = {}) {
    return this.httpClient.get<PagedResult<MyBillSummaryView>>(this.buildUrl('/customer/bills'), {
      params: toHttpParams({ page: query.page, pageSize: query.pageSize }),
    });
  }

  getById(billId: string) {
    return this.httpClient.get<MyBillView>(this.buildUrl(`/customer/bills/${billId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
