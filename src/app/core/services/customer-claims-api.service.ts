import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  CustomerClaimApproveRequest,
  CustomerClaimCandidate,
  CustomerClaimCreateRequest,
  CustomerClaimRejectRequest,
  CustomerClaimStatus,
  CustomerClaimView,
  OwnCustomerClaimView,
  OwnCustomerProfileCreateRequest,
  OwnCustomerProfileView,
  OwnCustomerStatusView,
} from '../models/customer-claim.models';
import { PageQuery, PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

/** The customer's own profile and claims (customer routes) and their review (customers.claims.approve). */
@Injectable({
  providedIn: 'root',
})
export class CustomerClaimsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  ownStatus() {
    return this.httpClient.get<OwnCustomerStatusView>(this.buildUrl('/customer/customer-profile'));
  }

  createOwnProfile(request: OwnCustomerProfileCreateRequest) {
    return this.httpClient.post<OwnCustomerProfileView>(this.buildUrl('/customer/customer-profile'), request);
  }

  submitClaim(request: CustomerClaimCreateRequest) {
    return this.httpClient.post<OwnCustomerClaimView>(this.buildUrl('/customer/customer-profile/claims'), request);
  }

  /** Claims in one status, paginated: pending ones oldest first (never filtered by date), decided ones newest first. */
  list(status: CustomerClaimStatus, query: PageQuery = {}) {
    return this.httpClient.get<PagedResult<CustomerClaimView>>(this.buildUrl('/admin/customer-claims'), {
      params: toHttpParams({ status, page: query.page, pageSize: query.pageSize }),
    });
  }

  candidates(claimId: string, query = '') {
    const params = query.trim() ? new HttpParams().set('q', query.trim()) : undefined;
    return this.httpClient.get<CustomerClaimCandidate[]>(this.buildUrl(`/admin/customer-claims/${claimId}/candidates`), { params });
  }

  approve(claimId: string, request: CustomerClaimApproveRequest) {
    return this.httpClient.post<CustomerClaimView>(this.buildUrl(`/admin/customer-claims/${claimId}/approve`), request);
  }

  reject(claimId: string, request: CustomerClaimRejectRequest) {
    return this.httpClient.post<CustomerClaimView>(this.buildUrl(`/admin/customer-claims/${claimId}/reject`), request);
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
