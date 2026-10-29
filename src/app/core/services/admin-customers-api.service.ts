import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  CustomerAccountCandidate,
  CustomerCreateFromAccountRequest,
  CustomerCreateRequest,
  CustomerDetailView,
  CustomerDuplicateCandidate,
  CustomerLinkAccountRequest,
  CustomerListItem,
  CustomerMergePreview,
  CustomerMergeRequest,
  CustomerUnlinkAccountRequest,
  CustomerUpdateRequest,
} from '../models/customer.models';

@Injectable({
  providedIn: 'root',
})
export class AdminCustomersApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  search(query?: string) {
    const params = query?.trim() ? new HttpParams().set('q', query.trim()) : undefined;
    return this.httpClient.get<CustomerListItem[]>(this.buildUrl('/admin/customers'), { params });
  }

  getById(customerId: string) {
    return this.httpClient.get<CustomerDetailView>(this.buildUrl(`/admin/customers/${customerId}`));
  }

  findDuplicates(
    email: string,
    phone: string,
    excludeCustomerId?: string | null,
    excludeUserId?: string | null,
  ) {
    let params = new HttpParams().set('email', email).set('phone', phone);
    if (excludeCustomerId) {
      params = params.set('excludeCustomerId', excludeCustomerId);
    }
    if (excludeUserId) {
      params = params.set('excludeUserId', excludeUserId);
    }
    return this.httpClient.get<CustomerDuplicateCandidate[]>(this.buildUrl('/admin/customers/duplicates'), {
      params,
    });
  }

  create(request: CustomerCreateRequest) {
    return this.httpClient.post<CustomerDetailView>(this.buildUrl('/admin/customers'), request);
  }

  createFromAccount(request: CustomerCreateFromAccountRequest) {
    return this.httpClient.post<CustomerDetailView>(this.buildUrl('/admin/customers/from-account'), request);
  }

  update(customerId: string, request: CustomerUpdateRequest) {
    return this.httpClient.put<CustomerDetailView>(this.buildUrl(`/admin/customers/${customerId}`), request);
  }

  getAccountCandidates(query?: string) {
    const params = query?.trim() ? new HttpParams().set('q', query.trim()) : undefined;
    return this.httpClient.get<CustomerAccountCandidate[]>(
      this.buildUrl('/admin/customers/account-candidates'),
      { params },
    );
  }

  linkAccount(customerId: string, request: CustomerLinkAccountRequest) {
    return this.httpClient.post<CustomerDetailView>(
      this.buildUrl(`/admin/customers/${customerId}/link-account`),
      request,
    );
  }

  unlinkAccount(customerId: string, request: CustomerUnlinkAccountRequest) {
    return this.httpClient.post<CustomerDetailView>(
      this.buildUrl(`/admin/customers/${customerId}/unlink-account`),
      request,
    );
  }

  getMergePreview(targetCustomerId: string, sourceCustomerId: string) {
    return this.httpClient.get<CustomerMergePreview>(
      this.buildUrl(`/admin/customers/${targetCustomerId}/merge-preview`),
      { params: new HttpParams().set('sourceCustomerId', sourceCustomerId) },
    );
  }

  merge(targetCustomerId: string, request: CustomerMergeRequest) {
    return this.httpClient.post<CustomerDetailView>(
      this.buildUrl(`/admin/customers/${targetCustomerId}/merge`),
      request,
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
