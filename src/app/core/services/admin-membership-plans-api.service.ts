import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  MembershipPlanStatusUpdateRequest,
  MembershipPlanUpsertRequest,
  MembershipPlanView,
} from '../models/membership-plan.models';

@Injectable({
  providedIn: 'root',
})
export class AdminMembershipPlansApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<MembershipPlanView[]>(this.buildUrl('/admin/membership-plans'));
  }

  getById(planId: string) {
    return this.httpClient.get<MembershipPlanView>(this.buildUrl(`/admin/membership-plans/${planId}`));
  }

  create(request: MembershipPlanUpsertRequest) {
    return this.httpClient.post<MembershipPlanView>(this.buildUrl('/admin/membership-plans'), request);
  }

  update(planId: string, request: MembershipPlanUpsertRequest) {
    return this.httpClient.put<MembershipPlanView>(this.buildUrl(`/admin/membership-plans/${planId}`), request);
  }

  updateStatus(planId: string, request: MembershipPlanStatusUpdateRequest) {
    return this.httpClient.patch<MembershipPlanView>(
      this.buildUrl(`/admin/membership-plans/${planId}/status`),
      request,
    );
  }

  remove(planId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/membership-plans/${planId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
