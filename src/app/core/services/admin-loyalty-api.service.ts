import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  LoyaltySettingsChangeView,
  LoyaltySettingsUpdateRequest,
  LoyaltySettingsView,
} from '../models/loyalty.models';

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

  listSettingsChanges() {
    return this.httpClient.get<LoyaltySettingsChangeView[]>(this.buildUrl('/admin/loyalty/settings/changes'));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
