import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { MembershipListQuery } from '../models/membership.models';
import { MyMembershipSummaryView, MyMembershipView } from '../models/my-membership.models';
import { PagedResult } from '../models/paged-result.models';
import { membershipParams } from './admin-memberships-api.service';

/** Read-only: the server resolves the owner from the signed-in account. */
@Injectable({
  providedIn: 'root',
})
export class CustomerMembershipsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  /** Own memberships, paginated and newest first (ADR-0016 B7). */
  list(query: MembershipListQuery = {}) {
    return this.httpClient.get<PagedResult<MyMembershipSummaryView>>(this.buildUrl('/customer/memberships'), {
      params: membershipParams(query),
    });
  }

  getById(membershipId: string) {
    return this.httpClient.get<MyMembershipView>(this.buildUrl(`/customer/memberships/${membershipId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
