import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  ProductCategoryUpsertRequest,
  ProductCategoryView,
  ProductListQuery,
  ProductUpsertRequest,
  ProductView,
} from '../models/product-catalog.models';
import { PagedResult } from '../models/paged-result.models';
import { toHttpParams } from '../utils/list-query.utils';
import { CatalogStatusUpdateRequest } from '../models/service-catalog.models';
import { getUploadFileName } from '../utils/upload-file-name.utils';

/** Masters of product categories and products (ADR-0016 B5). */
@Injectable({
  providedIn: 'root',
})
export class AdminProductCatalogApiService {
  private readonly httpClient = inject(HttpClient);
  private readonly runtimeConfigService = inject(RuntimeConfigService);

  listCategories() {
    return this.httpClient.get<ProductCategoryView[]>(this.buildUrl('/admin/product-categories'));
  }

  createCategory(request: ProductCategoryUpsertRequest) {
    return this.httpClient.post<ProductCategoryView>(this.buildUrl('/admin/product-categories'), request);
  }

  updateCategory(categoryId: string, request: ProductCategoryUpsertRequest) {
    return this.httpClient.put<ProductCategoryView>(this.buildUrl(`/admin/product-categories/${categoryId}`), request);
  }

  updateCategoryStatus(categoryId: string, request: CatalogStatusUpdateRequest) {
    return this.httpClient.patch<ProductCategoryView>(
      this.buildUrl(`/admin/product-categories/${categoryId}/status`),
      request,
    );
  }

  removeCategory(categoryId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/product-categories/${categoryId}`));
  }

  /** Paginated admin list of products in catalog order (ADR-0016 B7). */
  listProducts(query: ProductListQuery = {}) {
    const params = toHttpParams({
      q: query.q,
      categoryId: query.categoryId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.httpClient.get<PagedResult<ProductView>>(this.buildUrl('/admin/products'), { params });
  }

  createProduct(request: ProductUpsertRequest) {
    return this.httpClient.post<ProductView>(this.buildUrl('/admin/products'), request);
  }

  updateProduct(productId: string, request: ProductUpsertRequest) {
    return this.httpClient.put<ProductView>(this.buildUrl(`/admin/products/${productId}`), request);
  }

  updateProductStatus(productId: string, request: CatalogStatusUpdateRequest) {
    return this.httpClient.patch<ProductView>(this.buildUrl(`/admin/products/${productId}/status`), request);
  }

  removeProduct(productId: string) {
    return this.httpClient.delete<void>(this.buildUrl(`/admin/products/${productId}`));
  }

  /** Same transport as the staff photos: the raw file with X-Upload-* headers. The server converts it to JPEG. */
  uploadProductImage(productId: string, file: File) {
    const fileName = getUploadFileName(file, 'admin-product-image');
    return this.httpClient.post<ProductView>(this.buildUrl(`/admin/products/${productId}/image`), file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Upload-File-Name': encodeURIComponent(fileName),
        'X-Upload-File-Size': String(file.size),
        'X-Upload-File-Type': file.type || 'unknown',
      },
    });
  }

  removeProductImage(productId: string) {
    return this.httpClient.delete<ProductView>(this.buildUrl(`/admin/products/${productId}/image`));
  }

  private buildUrl(path: string): string {
    const apiBaseUrl = this.runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
    return `${apiBaseUrl}${path}`;
  }
}
