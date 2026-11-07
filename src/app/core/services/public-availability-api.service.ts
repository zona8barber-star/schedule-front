import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  PublicAvailabilitySlotsQuery,
  PublicAvailabilitySlotsResponse,
} from '../models/availability.models';

@Injectable({
  providedIn: 'root',
})
export class PublicAvailabilityApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  /** Free start times for a general service the professional offers, or for a plain duration (rescheduling). */
  getSlots(staffProfileId: string, from: string, to: string, query: PublicAvailabilitySlotsQuery) {
    let params = new HttpParams({
      fromObject: {
        from,
        to,
      },
    });
    params =
      'generalServiceId' in query
        ? params.set('generalServiceId', query.generalServiceId)
        : params.set('durationMinutes', String(query.durationMinutes));

    return this.httpClient.get<PublicAvailabilitySlotsResponse>(
      this.buildUrl(`/public/staff/${staffProfileId}/availability/slots`),
      { params },
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
