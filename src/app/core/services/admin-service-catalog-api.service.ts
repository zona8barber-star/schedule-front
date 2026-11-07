import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  CatalogStatusUpdateRequest,
  GeneralServiceUpsertRequest,
  GeneralServiceView,
  ServiceCategoryUpsertRequest,
  ServiceCategoryView,
} from '../models/service-catalog.models';

/** Masters of service categories and general services (ADR-0016 B1). */
@Injectable({
  providedIn: 'root',
})
export class AdminServiceCatalogApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  listCategories() {
    return this.httpClient.get<ServiceCategoryView[]>(this.buildUrl('/admin/service-categories'));
  }

  getCategory(categoryId: string) {
    return this.httpClient.get<ServiceCategoryView>(this.buildUrl(`/admin/service-categories/${categoryId}`));
  }

  createCategory(request: ServiceCategoryUpsertRequest) {
    return this.httpClient.post<ServiceCategoryView>(this.buildUrl('/admin/service-categories'), request);
  }

  updateCategory(categoryId: string, request: ServiceCategoryUpsertRequest) {
    return this.httpClient.put<ServiceCategoryView>(this.buildUrl(`/admin/service-categories/${categoryId}`), request);
  }

  updateCategoryStatus(categoryId: string, request: CatalogStatusUpdateRequest) {
    return this.httpClient.patch<ServiceCategoryView>(
      this.buildUrl(`/admin/service-categories/${categoryId}/status`),
      request,
    );
  }

  removeCategory(categoryId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/service-categories/${categoryId}`));
  }

  listGeneralServices(categoryId?: string | null) {
    const params = categoryId ? new HttpParams().set('categoryId', categoryId) : undefined;
    return this.httpClient.get<GeneralServiceView[]>(this.buildUrl('/admin/general-services'), { params });
  }

  getGeneralService(generalServiceId: string) {
    return this.httpClient.get<GeneralServiceView>(this.buildUrl(`/admin/general-services/${generalServiceId}`));
  }

  createGeneralService(request: GeneralServiceUpsertRequest) {
    return this.httpClient.post<GeneralServiceView>(this.buildUrl('/admin/general-services'), request);
  }

  updateGeneralService(generalServiceId: string, request: GeneralServiceUpsertRequest) {
    return this.httpClient.put<GeneralServiceView>(
      this.buildUrl(`/admin/general-services/${generalServiceId}`),
      request,
    );
  }

  updateGeneralServiceStatus(generalServiceId: string, request: CatalogStatusUpdateRequest) {
    return this.httpClient.patch<GeneralServiceView>(
      this.buildUrl(`/admin/general-services/${generalServiceId}/status`),
      request,
    );
  }

  removeGeneralService(generalServiceId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/general-services/${generalServiceId}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
