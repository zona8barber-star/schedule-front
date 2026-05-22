import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { PublicStaffListItemResponse, PublicStaffProfileResponse } from '../models/content.models';

@Injectable({
  providedIn: 'root',
})
export class PublicStaffApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  list(search?: string | null) {
    const normalizedSearch = search?.trim();
    const params = normalizedSearch
      ? new HttpParams({ fromObject: { search: normalizedSearch } })
      : undefined;

    return this.httpClient.get<PublicStaffListItemResponse[]>(this.buildUrl('/public/staff'), {
      params,
    });
  }

  getById(staffProfileId: string) {
    return this.httpClient.get<PublicStaffProfileResponse>(
      this.buildUrl(`/public/staff/${staffProfileId}`),
    );
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
