import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  BannerResponse,
  BrandingSettingsResponse,
  LandingContentResponse,
} from '../models/content.models';

@Injectable({
  providedIn: 'root',
})
export class PublicContentApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getLanding() {
    return this.httpClient.get<LandingContentResponse>(this.buildUrl('/public/content/landing'));
  }

  getBanners() {
    return this.httpClient.get<BannerResponse[]>(this.buildUrl('/public/content/banners'));
  }

  getBranding() {
    return this.httpClient.get<BrandingSettingsResponse>(this.buildUrl('/public/content/branding'));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
