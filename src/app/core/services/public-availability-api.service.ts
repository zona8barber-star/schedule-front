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

  /**
   * Free start times for a general service the professional offers, or, to reschedule, for the signed-in customer's
   * own appointment (same grid and validation as the API, without that appointment among the occupied times).
   */
  getSlots(staffProfileId: string, from: string, to: string, query: PublicAvailabilitySlotsQuery) {
    const params = new HttpParams({
      fromObject: {
        from,
        to,
      },
    });

    if ('rescheduleAppointmentId' in query) {
      return this.httpClient.get<PublicAvailabilitySlotsResponse>(
        this.buildUrl(`/customer/appointments/${query.rescheduleAppointmentId}/reschedule-slots`),
        { params },
      );
    }

    return this.httpClient.get<PublicAvailabilitySlotsResponse>(
      this.buildUrl(`/public/staff/${staffProfileId}/availability/slots`),
      { params: params.set('generalServiceId', query.generalServiceId) },
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
