import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { formatCop } from '../models/product-catalog.models';
import { PublicProductCatalogApiService } from './public-product-catalog-api.service';

describe('PublicProductCatalogApiService', () => {
  let service: PublicProductCatalogApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublicProductCatalogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads categories, a category and a product by their public codes', () => {
    service.listCategories().subscribe();
    httpMock.expectOne(`${api}/public/product-categories`).flush([]);

    service.getCategory('ceras001').subscribe();
    httpMock.expectOne(`${api}/public/product-categories/ceras001`).flush({ code: 'ceras001', name: 'Ceras', products: [] });

    service.getProduct('cera0001').subscribe();
    httpMock.expectOne(`${api}/public/products/cera0001`).flush({});
  });

  it('escapes a code typed by hand', () => {
    service.getProduct('a/b').subscribe({ error: () => undefined });
    httpMock.expectOne(`${api}/public/products/a%2Fb`).flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('formats prices as whole Colombian pesos', () => {
    expect(formatCop(35000).replace(/\s/g, ' ')).toMatch(/^\$ ?35\.000$/);
    expect(formatCop(0).replace(/\s/g, ' ')).toMatch(/^\$ ?0$/);
  });
});
