import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ServiceRecordView } from '../models/service-record.models';
import { ServiceRecordsApiService } from './service-records-api.service';

describe('ServiceRecordsApiService', () => {
  let service: ServiceRecordsApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ServiceRecordsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('registers on the staff route with the idempotency key', () => {
    const request = {
      appointmentId: null,
      performedOn: '2026-11-03',
      customerName: null,
      serviceIds: ['s-1', 's-2'],
      notes: null,
      idempotencyKey: 'key-1',
    };
    service.register(request).subscribe();
    const req = httpMock.expectOne(`${api}/staff/service-records`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush([] as ServiceRecordView[]);
  });

  it('lists the review inbox by status', () => {
    service.list('Pending').subscribe();
    const req = httpMock.expectOne((candidate) => candidate.url === `${api}/admin/service-records`);
    expect(req.request.params.get('status')).toBe('Pending');
    req.flush([]);
  });

  it('approves and rejects on the record routes', () => {
    service.reject('r-1', { version: 7, reason: 'Duplicado' }).subscribe();
    const reject = httpMock.expectOne(`${api}/admin/service-records/r-1/reject`);
    expect(reject.request.body).toEqual({ version: 7, reason: 'Duplicado' });
    reject.flush({});

    service
      .approve('r-1', {
        version: 7,
        operationType: 'Courtesy',
        serviceId: 's-1',
        staffProfileId: 'st-1',
        customerId: null,
        performedOn: '2026-11-03',
        chargedAmount: null,
        customerMembershipId: null,
        accruesLoyaltyPoints: false,
        notes: null,
      })
      .subscribe();
    const approve = httpMock.expectOne(`${api}/admin/service-records/r-1/approve`);
    expect(approve.request.method).toBe('POST');
    approve.flush({});
  });
});
