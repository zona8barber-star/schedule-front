import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { PublicAvailabilitySlotsResponse } from '../models/availability.models';

@Injectable({
  providedIn: 'root',
})
export class PublicAvailabilityApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getSlots(staffProfileId: string, from: string, to: string) {
    const params = new HttpParams({
      fromObject: {
        from,
        to,
      },
    });

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
