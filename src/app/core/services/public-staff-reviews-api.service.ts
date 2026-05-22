import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { PublicStaffReviewResponse, StaffReviewSummaryResponse } from '../models/review.models';

@Injectable({
  providedIn: 'root',
})
export class PublicStaffReviewsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  listByStaffProfileId(staffProfileId: string) {
    return this.httpClient.get<PublicStaffReviewResponse[]>(
      this.buildUrl(`/public/staff/${staffProfileId}/reviews`),
    );
  }

  getSummaryByStaffProfileId(staffProfileId: string) {
    return this.httpClient.get<StaffReviewSummaryResponse>(
      this.buildUrl(`/public/staff/${staffProfileId}/reviews/summary`),
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
