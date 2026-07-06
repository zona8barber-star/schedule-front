import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  ServiceCreateRequest,
  ServiceStatusUpdateRequest,
  ServiceUpdateRequest,
  ServiceView,
} from '../models/service.models';

@Injectable({
  providedIn: 'root',
})
export class AdminServicesApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<ServiceView[]>(this.buildUrl('/admin/services'));
  }

  getById(serviceId: string) {
    return this.httpClient.get<ServiceView>(this.buildUrl(`/admin/services/${serviceId}`));
  }

  create(request: ServiceCreateRequest) {
    return this.httpClient.post<ServiceView>(this.buildUrl('/admin/services'), request);
  }

  update(serviceId: string, request: ServiceUpdateRequest) {
    return this.httpClient.put<ServiceView>(this.buildUrl(`/admin/services/${serviceId}`), request);
  }

  updateStatus(serviceId: string, request: ServiceStatusUpdateRequest) {
    return this.httpClient.patch<ServiceView>(
      this.buildUrl(`/admin/services/${serviceId}/status`),
      request,
    );
  }

  remove(serviceId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/services/${serviceId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
