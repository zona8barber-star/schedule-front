import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { MembershipPlanUpsertRequest } from '../models/membership-plan.models';
import { AdminMembershipPlansApiService } from './admin-membership-plans-api.service';

describe('AdminMembershipPlansApiService', () => {
  let service: AdminMembershipPlansApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/membership-plans`;

  const request: MembershipPlanUpsertRequest = {
    name: 'Oro',
    description: null,
    price: 250000,
    mode: 'Pool',
    poolQuantity: 10,
    defaultDurationDays: 90,
    terms: 'Términos',
    specificConditions: null,
    services: [{ serviceId: 's-1', quantity: null }],
    giftRules: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminMembershipPlansApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list and getById call GET', () => {
    service.list().subscribe();
    expect(httpMock.expectOne(base).request.method).toBe('GET');

    service.getById('p-1').subscribe();
    expect(httpMock.expectOne(`${base}/p-1`).request.method).toBe('GET');
  });

  it('create and update send the request body', () => {
    service.create(request).subscribe();
    const createReq = httpMock.expectOne(base);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(request);
    createReq.flush({});

    service.update('p-1', request).subscribe();
    const updateReq = httpMock.expectOne(`${base}/p-1`);
    expect(updateReq.request.method).toBe('PUT');
    expect(updateReq.request.body).toEqual(request);
    updateReq.flush({});
  });

  it('updateStatus calls PATCH on /status and remove calls DELETE', () => {
    service.updateStatus('p-1', { isActive: false }).subscribe();
    const statusReq = httpMock.expectOne(`${base}/p-1/status`);
    expect(statusReq.request.method).toBe('PATCH');
    expect(statusReq.request.body).toEqual({ isActive: false });
    statusReq.flush({});

    service.remove('p-1').subscribe();
    const deleteReq = httpMock.expectOne(`${base}/p-1`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
  });
});
