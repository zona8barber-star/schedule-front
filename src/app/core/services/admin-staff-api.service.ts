import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  AdminStaffCreateRequest,
  AdminStaffUpdateRequest,
  StaffListItem,
  StaffResponse,
  StaffStatusUpdateRequest,
} from '../models/staff.models';

@Injectable({
  providedIn: 'root',
})
export class AdminStaffApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list() {
    return this.httpClient.get<StaffListItem[]>(this.buildUrl('/admin/staff'));
  }

  getById(staffId: string) {
    return this.httpClient.get<StaffResponse>(this.buildUrl(`/admin/staff/${staffId}`));
  }

  create(request: AdminStaffCreateRequest) {
    return this.httpClient.post<StaffResponse>(this.buildUrl('/admin/staff'), request);
  }

  update(staffId: string, request: AdminStaffUpdateRequest) {
    return this.httpClient.put<StaffResponse>(this.buildUrl(`/admin/staff/${staffId}`), request);
  }

  updateStatus(staffId: string, request: StaffStatusUpdateRequest) {
    return this.httpClient.patch<StaffResponse>(
      this.buildUrl(`/admin/staff/${staffId}/status`),
      request,
    );
  }

  remove(staffId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/staff/${staffId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
