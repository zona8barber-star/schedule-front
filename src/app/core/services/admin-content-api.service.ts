import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  BannerResponse,
  BrandingSettingsResponse,
  CreateBannerRequest,
  LandingContentResponse,
  UpdateBannerRequest,
  UpsertBrandingSettingsRequest,
  UpsertLandingContentRequest,
} from '../models/content.models';

@Injectable({
  providedIn: 'root',
})
export class AdminContentApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  getLanding() {
    return this.httpClient.get<LandingContentResponse>(this.buildUrl('/admin/content/landing'));
  }

  updateLanding(request: UpsertLandingContentRequest) {
    return this.httpClient.put<LandingContentResponse>(
      this.buildUrl('/admin/content/landing'),
      request,
    );
  }

  getBranding() {
    return this.httpClient.get<BrandingSettingsResponse>(this.buildUrl('/admin/content/branding'));
  }

  updateBranding(request: UpsertBrandingSettingsRequest) {
    return this.httpClient.put<BrandingSettingsResponse>(
      this.buildUrl('/admin/content/branding'),
      request,
    );
  }

  listBanners() {
    return this.httpClient.get<BannerResponse[]>(this.buildUrl('/admin/content/banners'));
  }

  getBannerById(bannerId: string) {
    return this.httpClient.get<BannerResponse>(this.buildUrl(`/admin/content/banners/${bannerId}`));
  }

  createBanner(request: CreateBannerRequest) {
    return this.httpClient.post<BannerResponse>(this.buildUrl('/admin/content/banners'), request);
  }

  updateBanner(bannerId: string, request: UpdateBannerRequest) {
    return this.httpClient.put<BannerResponse>(
      this.buildUrl(`/admin/content/banners/${bannerId}`),
      request,
    );
  }

  deleteBanner(bannerId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/content/banners/${bannerId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
