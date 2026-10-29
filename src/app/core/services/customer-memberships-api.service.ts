import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { MyMembershipSummaryView, MyMembershipView } from '../models/my-membership.models';

/** Read-only: the server resolves the owner from the signed-in account. */
@Injectable({
  providedIn: 'root',
})
export class CustomerMembershipsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<MyMembershipSummaryView[]>(this.buildUrl('/customer/memberships'));
  }

  getById(membershipId: string) {
    return this.httpClient.get<MyMembershipView>(this.buildUrl(`/customer/memberships/${membershipId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
