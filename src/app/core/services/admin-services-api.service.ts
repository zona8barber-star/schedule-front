import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  ServiceCreateRequest,
  ServiceStatusUpdateRequest,
  ServiceUpdateRequest,
  ServiceUsageView,
  ServiceListQuery,
  ServiceView,
} from '../models/service.models';
import { PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

@Injectable({
  providedIn: 'root',
})
export class AdminServicesApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  /** Paginated admin list of rates (ADR-0016 B7). */
  list(query: ServiceListQuery = {}) {
    const params = toHttpParams({
      q: query.q,
      generalServiceId: query.generalServiceId,
      categoryId: query.categoryId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.httpClient.get<PagedResult<ServiceView>>(this.buildUrl('/admin/services'), { params });
  }

  /** Every rate, for selectors (not paginated). */
  options() {
    return this.httpClient.get<ServiceView[]>(this.buildUrl('/admin/services/options'));
  }

  getById(serviceId: string) {
    return this.httpClient.get<ServiceView>(this.buildUrl(`/admin/services/${serviceId}`));
  }

  create(request: ServiceCreateRequest) {
    return this.httpClient.post<ServiceView>(this.buildUrl('/admin/services'), request);
  }

  update(serviceId: string, request: ServiceUpdateRequest) {
    return this.httpClient.put<ServiceView>(this.buildUrl(`/admin/services/${serviceId}`), request);
  }

  updateStatus(serviceId: string, request: ServiceStatusUpdateRequest) {
    return this.httpClient.patch<ServiceView>(
      this.buildUrl(`/admin/services/${serviceId}/status`),
      request,
    );
  }

  /** Active plans and rewards that use the rate (SONDA BUG-103), to warn before deleting it. */
  getUsage(serviceId: string) {
    return this.httpClient.get<ServiceUsageView>(this.buildUrl(`/admin/services/${serviceId}/usage`));
  }

  remove(serviceId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/services/${serviceId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
