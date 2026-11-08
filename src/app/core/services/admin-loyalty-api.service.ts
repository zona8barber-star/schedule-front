import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  LoyaltySettingsChangeView,
  LoyaltySettingsUpdateRequest,
  LoyaltySettingsView,
} from '../models/loyalty.models';
import { PageQuery, PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';

@Injectable({
  providedIn: 'root',
})
export class AdminLoyaltyApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getSettings() {
    return this.httpClient.get<LoyaltySettingsView>(this.buildUrl('/admin/loyalty/settings'));
  }

  updateSettings(request: LoyaltySettingsUpdateRequest) {
    return this.httpClient.put<LoyaltySettingsView>(this.buildUrl('/admin/loyalty/settings'), request);
  }

  /** Change log of the settings, newest first, paginated. */
  listSettingsChanges(query: PageQuery = {}) {
    return this.httpClient.get<PagedResult<LoyaltySettingsChangeView>>(this.buildUrl('/admin/loyalty/settings/changes'), {
      params: toHttpParams({ page: query.page, pageSize: query.pageSize }),
    });
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
