import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AdminProductCatalogApiService } from './admin-product-catalog-api.service';

describe('AdminProductCatalogApiService', () => {
  let service: AdminProductCatalogApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminProductCatalogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('manages product categories', () => {
    service.listCategories().subscribe();
    httpMock.expectOne(`${api}/admin/product-categories`).flush([]);

    service.createCategory({ name: 'Ceras', sortOrder: 1 }).subscribe();
    const create = httpMock.expectOne(`${api}/admin/product-categories`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Ceras', sortOrder: 1 });
    create.flush({});

    service.updateCategoryStatus('c-1', { isActive: false }).subscribe();
    const status = httpMock.expectOne(`${api}/admin/product-categories/c-1/status`);
    expect(status.request.method).toBe('PATCH');
    status.flush({});

    service.removeCategory('c-1').subscribe();
    expect(httpMock.expectOne(`${api}/admin/product-categories/c-1`).request.method).toBe('DELETE');
  });

  it('lists products paginated, sending only the filters that are set', () => {
    service.listProducts().subscribe();
    const all = httpMock.expectOne((request) => request.url === `${api}/admin/products`);
    expect(all.request.params.keys()).toEqual([]);
    all.flush({ items: [], page: 1, pageSize: 20, totalCount: 0 });

    service.listProducts({ q: 'cera', categoryId: 'c-1', status: 'Active', page: 2, pageSize: 50 }).subscribe();
    const filtered = httpMock.expectOne((request) => request.url === `${api}/admin/products`);
    expect(filtered.request.params.get('q')).toBe('cera');
    expect(filtered.request.params.get('categoryId')).toBe('c-1');
    expect(filtered.request.params.get('status')).toBe('Active');
    expect(filtered.request.params.get('page')).toBe('2');
    expect(filtered.request.params.get('pageSize')).toBe('50');
    filtered.flush({ items: [], page: 2, pageSize: 50, totalCount: 0 });
  });

  it('creates and updates a product with its price', () => {
    const request = { categoryId: 'c-1', name: 'Cera', description: null, price: 35000, sortOrder: 0 };
    service.createProduct(request).subscribe();
    const create = httpMock.expectOne(`${api}/admin/products`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    create.flush({});

    service.updateProduct('p-1', request).subscribe();
    expect(httpMock.expectOne(`${api}/admin/products/p-1`).request.method).toBe('PUT');
  });

  it('uploads the image as the raw file with the upload headers, and removes it', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'cera.heic', { type: 'image/heic' });
    service.uploadProductImage('p-1', file).subscribe();

    const upload = httpMock.expectOne(`${api}/admin/products/p-1/image`);
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body).toBe(file);
    expect(upload.request.headers.get('Content-Type')).toBe('image/heic');
    expect(upload.request.headers.get('X-Upload-File-Name')).toBe('cera.heic');
    expect(upload.request.headers.get('X-Upload-File-Size')).toBe('3');
    upload.flush({});

    service.removeProductImage('p-1').subscribe();
    expect(httpMock.expectOne(`${api}/admin/products/p-1/image`).request.method).toBe('DELETE');
  });
});
