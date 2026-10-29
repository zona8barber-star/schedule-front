import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { CustomerMembershipsApiService } from './customer-memberships-api.service';

describe('CustomerMembershipsApiService', () => {
  let service: CustomerMembershipsApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CustomerMembershipsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('only reads the signed-in customer’s memberships, without sending any customer id', () => {
    service.list().subscribe();
    const list = httpMock.expectOne(`${api}/customer/memberships`);
    expect(list.request.method).toBe('GET');

    service.getById('m-1').subscribe();
    const detail = httpMock.expectOne(`${api}/customer/memberships/m-1`);
    expect(detail.request.method).toBe('GET');
    expect(detail.request.params.keys()).toEqual([]);
  });
});
