import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  PublicProduct,
  PublicProductCategory,
  PublicProductCategoryDetail,
} from '../models/product-catalog.models';

/** The anonymous product catalog (ADR-0016 B6), addressed by immutable public codes. */
@Injectable({
  providedIn: 'root',
})
export class PublicProductCatalogApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  listCategories() {
    return this.httpClient.get<PublicProductCategory[]>(this.buildUrl('/public/product-categories'));
  }

  getCategory(categoryCode: string) {
    return this.httpClient.get<PublicProductCategoryDetail>(
      this.buildUrl(`/public/product-categories/${encodeURIComponent(categoryCode)}`),
    );
  }

  getProduct(productCode: string) {
    return this.httpClient.get<PublicProduct>(this.buildUrl(`/public/products/${encodeURIComponent(productCode)}`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
