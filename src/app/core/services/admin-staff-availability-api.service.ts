import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  AvailabilityRule,
  AvailabilityRuleUpsertRequest,
  AvailabilitySummary,
  CreateUnavailablePeriodRequest,
  UnavailablePeriod,
  UpdateUnavailablePeriodRequest,
} from '../models/availability.models';

@Injectable({
  providedIn: 'root',
})
export class AdminStaffAvailabilityApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getSummary(staffId: string) {
    return this.httpClient.get<AvailabilitySummary>(this.buildUrl(staffId, ''));
  }

  updateWeeklyRules(staffId: string, request: AvailabilityRuleUpsertRequest[]) {
    return this.httpClient.put<AvailabilityRule[]>(this.buildUrl(staffId, '/rules'), request);
  }

  listUnavailablePeriods(staffId: string) {
    return this.httpClient.get<UnavailablePeriod[]>(
      this.buildUrl(staffId, '/unavailable-periods'),
    );
  }

  createUnavailablePeriod(staffId: string, request: CreateUnavailablePeriodRequest) {
    return this.httpClient.post<UnavailablePeriod>(
      this.buildUrl(staffId, '/unavailable-periods'),
      request,
    );
  }

  updateUnavailablePeriod(
    staffId: string,
    unavailablePeriodId: string,
    request: UpdateUnavailablePeriodRequest,
  ) {
    return this.httpClient.put<UnavailablePeriod>(
      this.buildUrl(staffId, `/unavailable-periods/${unavailablePeriodId}`),
      request,
    );
  }

  deleteUnavailablePeriod(staffId: string, unavailablePeriodId: string) {
    return this.httpClient.delete<void>(
      this.buildUrl(staffId, `/unavailable-periods/${unavailablePeriodId}`),
    );
  }

  private buildUrl(staffId: string, suffix: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}/admin/staff/${staffId}/availability${suffix}`;
  }
}
