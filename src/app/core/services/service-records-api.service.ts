import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { CustomerCreateRequest } from '../models/customer.models';
import {
  ServiceRecordAppointmentOption,
  ServiceRecordApproveRequest,
  ServiceRecordCatalogItem,
  ServiceRecordCustomerDuplicate,
  ServiceRecordCustomerOption,
  ServiceRecordEligibilityView,
  ServiceRecordOptionsView,
  ServiceRecordRedemptionOption,
  ServiceRecordRelatedView,
  ServiceRecordRegisterRequest,
  ServiceRecordRejectRequest,
  ServiceRecordListQuery,
  ServiceRecordView,
} from '../models/service-record.models';
import { PageQuery, PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

/** Services performed: the professional's registration (staff routes) and the administrative review. */
@Injectable({
  providedIn: 'root',
})
export class ServiceRecordsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  catalog() {
    return this.httpClient.get<ServiceRecordCatalogItem[]>(this.buildUrl('/staff/service-records/catalog'));
  }

  eligibility() {
    return this.httpClient.get<ServiceRecordEligibilityView>(this.buildUrl('/staff/service-records/eligibility'));
  }

  appointments() {
    return this.httpClient.get<ServiceRecordAppointmentOption[]>(this.buildUrl('/staff/service-records/appointments'));
  }

  /** Own records, paginated: pending ones first (oldest first), then the reviewed ones, newest first. */
  mine(query: PageQuery = {}) {
    return this.httpClient.get<PagedResult<ServiceRecordView>>(this.buildUrl('/staff/service-records'), {
      params: toHttpParams({ page: query.page, pageSize: query.pageSize }),
    });
  }

  register(request: ServiceRecordRegisterRequest) {
    return this.httpClient.post<ServiceRecordView[]>(this.buildUrl('/staff/service-records'), request);
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

  customerOptions(query: string) {
    const params = query.trim() ? new HttpParams().set('q', query.trim()) : undefined;
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
