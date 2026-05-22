import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { CustomerReviewResponse, ReviewCreateRequest } from '../models/review.models';

@Injectable({
  providedIn: 'root',
})
export class CustomerReviewsApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<CustomerReviewResponse[]>(this.buildUrl('/customer/reviews'));
  }

  create(appointmentId: string, request: ReviewCreateRequest) {
    return this.httpClient.post<CustomerReviewResponse>(
      this.buildUrl(`/customer/appointments/${appointmentId}/review`),
      request,
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
