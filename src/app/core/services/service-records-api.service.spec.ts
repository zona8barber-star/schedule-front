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
      generalServiceIds: ['g-1', 'g-2'],
      notes: null,
      idempotencyKey: 'key-1',
    };
    service.register(request).subscribe();
    const req = httpMock.expectOne(`${api}/staff/service-records`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush([] as ServiceRecordView[]);
  });

  it('lists the own records one page at a time', () => {
    service.mine({ page: 5, pageSize: 25 }).subscribe();
    const req = httpMock.expectOne(`${api}/staff/service-records?page=5&pageSize=25`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] as ServiceRecordView[], page: 5, pageSize: 25, totalCount: 105 });
  });

  it('lists the review inbox paginated, by status and the other filters', () => {
    service
      .list({ status: 'Approved', from: '2026-11-01', to: '2026-11-06', staffProfileId: 'st-1', generalServiceId: 'g-1', page: 3 })
      .subscribe();
    const req = httpMock.expectOne((candidate) => candidate.url === `${api}/admin/service-records`);
    expect(req.request.params.get('status')).toBe('Approved');
    expect(req.request.params.get('from')).toBe('2026-11-01');
    expect(req.request.params.get('to')).toBe('2026-11-06');
    expect(req.request.params.get('staffProfileId')).toBe('st-1');
    expect(req.request.params.get('generalServiceId')).toBe('g-1');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.has('pageSize')).toBe(false);
    req.flush({ items: [], page: 3, pageSize: 20, totalCount: 0 });
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
        generalServiceId: 'g-1',
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
    expect(approve.request.body.generalServiceId).toBe('g-1');
    approve.flush({});
  });
});
