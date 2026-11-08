import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { CustomerClaimsApiService } from './customer-claims-api.service';

describe('CustomerClaimsApiService', () => {
  let service: CustomerClaimsApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CustomerClaimsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uses the customer routes for the own profile and claims', () => {
    service.ownStatus().subscribe();
    httpMock.expectOne(`${api}/customer/customer-profile`).flush({});

    service.createOwnProfile({ fullName: 'Carla', phone: '3001234567', email: 'c@example.com' }).subscribe();
    expect(httpMock.expectOne(`${api}/customer/customer-profile`).request.method).toBe('POST');

    service.submitClaim({ fullName: 'Carla', phone: '3001234567', email: 'c@example.com', notes: null, idempotencyKey: 'k' }).subscribe();
    expect(httpMock.expectOne(`${api}/customer/customer-profile/claims`).request.body.idempotencyKey).toBe('k');
  });

  it('uses the admin routes to review claims', () => {
    service.list('Pending').subscribe();
    const claims = httpMock.expectOne((request) => request.url === `${api}/admin/customer-claims`);
    expect(claims.request.params.get('status')).toBe('Pending');
    claims.flush({ items: [], page: 1, pageSize: 25, totalCount: 0 });

    service.approve('k-1', { version: 3, customerId: 'c-1', identityVerified: true, notes: null }).subscribe();
    expect(httpMock.expectOne(`${api}/admin/customer-claims/k-1/approve`).request.body.identityVerified).toBe(true);

    service.reject('k-1', { version: 3, reason: 'No' }).subscribe();
    expect(httpMock.expectOne(`${api}/admin/customer-claims/k-1/reject`).request.method).toBe('POST');
  });
});
