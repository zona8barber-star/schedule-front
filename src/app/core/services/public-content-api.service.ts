import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  PublicBannerResponse,
  PublicBrandingResponse,
  BusinessScheduleResponse,
  PublicLandingContentResponse,
  PublicTickerItemResponse,
} from '../models/content.models';

@Injectable({
  providedIn: 'root',
})
export class PublicContentApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getLanding() {
    return this.httpClient.get<PublicLandingContentResponse>(this.buildUrl('/public/content/landing'));
  }

  getBanners() {
    return this.httpClient.get<PublicBannerResponse[]>(this.buildUrl('/public/content/banners'));
  }

  getTickerItems() {
    return this.httpClient.get<PublicTickerItemResponse[]>(this.buildUrl('/public/content/ticker-items'));
  }

  getBranding() {
    return this.httpClient.get<PublicBrandingResponse>(this.buildUrl('/public/content/branding'));
  }

  getBusinessSchedule() {
    return this.httpClient.get<BusinessScheduleResponse>(this.buildUrl('/public/content/business-hours'));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
