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
export class StaffAvailabilityApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getAvailabilitySummary() {
    return this.httpClient.get<AvailabilitySummary>(this.buildUrl('/staff/availability'));
  }

  updateWeeklyRules(request: AvailabilityRuleUpsertRequest[]) {
    return this.httpClient.put<AvailabilityRule[]>(
      this.buildUrl('/staff/availability/rules'),
      request,
    );
  }

  listUnavailablePeriods() {
    return this.httpClient.get<UnavailablePeriod[]>(
      this.buildUrl('/staff/availability/unavailable-periods'),
    );
  }

  createUnavailablePeriod(request: CreateUnavailablePeriodRequest) {
    return this.httpClient.post<UnavailablePeriod>(
      this.buildUrl('/staff/availability/unavailable-periods'),
      request,
    );
  }

  updateUnavailablePeriod(unavailablePeriodId: string, request: UpdateUnavailablePeriodRequest) {
    return this.httpClient.put<UnavailablePeriod>(
      this.buildUrl(`/staff/availability/unavailable-periods/${unavailablePeriodId}`),
      request,
    );
  }

  deleteUnavailablePeriod(unavailablePeriodId: string) {
    return this.httpClient.delete<void>(
      this.buildUrl(`/staff/availability/unavailable-periods/${unavailablePeriodId}`),
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
