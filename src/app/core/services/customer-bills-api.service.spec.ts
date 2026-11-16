import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { CustomerBillsApiService } from './customer-bills-api.service';

describe('CustomerBillsApiService', () => {
  let service: CustomerBillsApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CustomerBillsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the own receipts one page at a time', () => {
    service.list({ page: 2, pageSize: 10 }).subscribe();
    const req = httpMock.expectOne(`${api}/customer/bills?page=2&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], page: 2, pageSize: 10, totalCount: 0 });
  });

  it('reads one receipt', () => {
    service.getById('b-1').subscribe();
    httpMock.expectOne(`${api}/customer/bills/b-1`).flush({});
  });
});
