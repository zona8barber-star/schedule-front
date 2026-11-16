import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { CustomerCreateRequest } from '../models/customer.models';
import {
  ServiceRecordApproveRequest,
  ServiceRecordCustomerDuplicate,
  ServiceRecordCustomerOption,
  ServiceRecordOptionsView,
  ServiceRecordRedemptionOption,
  ServiceRecordRelatedView,
  ServiceRecordRejectRequest,
  ServiceRecordListQuery,
  ServiceRecordView,
} from '../models/service-record.models';
import { PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

/**
 * Services performed before the bills: the administrative review of the records that remain and the read-only history.
 * The professional's registration was retired by the bills (ADR-0020 stages 2 and 6).
 */
@Injectable({
  providedIn: 'root',
})
export class ServiceRecordsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  /** ADR-0020 stage 6: how many records still wait for review (the tray leaves the menu when none remain). */
  pendingCount() {
    return this.httpClient.get<{ count: number }>(this.buildUrl('/admin/service-records/pending-count'));
  }

  /** Admin review list, paginated (ADR-0016 B7). */
  list(query: ServiceRecordListQuery = {}) {
    const params = toHttpParams({
      status: query.status,
      from: query.from,
      to: query.to,
      staffProfileId: query.staffProfileId,
      generalServiceId: query.generalServiceId,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.httpClient.get<PagedResult<ServiceRecordView>>(this.buildUrl('/admin/service-records'), { params });
  }

  options() {
    return this.httpClient.get<ServiceRecordOptionsView>(this.buildUrl('/admin/service-records/options'));
  }

  /** serviceDate (SONDA BUG-085): only memberships valid on that day are offered. */
  customerOptions(query: string, serviceDate?: string | null) {
    let params = new HttpParams();
    if (query.trim()) params = params.set('q', query.trim());
    if (serviceDate) params = params.set('serviceDate', serviceDate);
    return this.httpClient.get<ServiceRecordCustomerOption[]>(this.buildUrl('/admin/service-records/customer-options'), { params });
  }

  related(serviceRecordId: string) {
    return this.httpClient.get<ServiceRecordRelatedView>(this.buildUrl(`/admin/service-records/${serviceRecordId}/related`));
  }

  /** Approved service redemptions of the customer that a 'LoyaltyReward' confirmation can deliver. */
  getRedemptionOptions(customerId: string, serviceId: string | null) {
    let params = new HttpParams().set('customerId', customerId);
    if (serviceId) {
      params = params.set('serviceId', serviceId);
    }

    return this.httpClient.get<ServiceRecordRedemptionOption[]>(this.buildUrl('/admin/service-records/redemption-options'), {
      params,
    });
  }

  /** Same creation and duplicate check as the customers module, available to approvers without the Admin role. */
  createCustomer(request: CustomerCreateRequest) {
    return this.httpClient.post<ServiceRecordCustomerOption>(this.buildUrl('/admin/service-records/customers'), request);
  }

  findCustomerDuplicates(email: string, phone: string) {
    return this.httpClient.get<ServiceRecordCustomerDuplicate[]>(this.buildUrl('/admin/service-records/customer-duplicates'), {
      params: new HttpParams().set('email', email).set('phone', phone),
    });
  }

  approve(serviceRecordId: string, request: ServiceRecordApproveRequest) {
    return this.httpClient.post<ServiceRecordView>(this.buildUrl(`/admin/service-records/${serviceRecordId}/approve`), request);
  }

  reject(serviceRecordId: string, request: ServiceRecordRejectRequest) {
    return this.httpClient.post<ServiceRecordView>(this.buildUrl(`/admin/service-records/${serviceRecordId}/reject`), request);
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
