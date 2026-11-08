import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AdminAppointmentsApiService } from './admin-appointments-api.service';

describe('AdminAppointmentsApiService', () => {
  let service: AdminAppointmentsApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminAppointmentsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists the agenda paginated with every filter, leaving out the empty ones', () => {
    service
      .list({
        from: '2026-11-01',
        to: '2026-11-30',
        staffProfileId: 'st-1',
        status: 'Pending,Confirmed',
        generalServiceId: null,
        customer: 'carla',
        sort: 'Asc',
        page: 2,
        pageSize: 50,
      })
      .subscribe();
    const req = httpMock.expectOne((candidate) => candidate.url === `${api}/admin/appointments`);
    expect(req.request.params.keys().sort()).toEqual(['customer', 'from', 'page', 'pageSize', 'sort', 'staffProfileId', 'status', 'to']);
    expect(req.request.params.get('status')).toBe('Pending,Confirmed');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], page: 2, pageSize: 50, totalCount: 0 });
  });

  it('lists the bookable offerings of a professional', () => {
    service.serviceOptions('st-1').subscribe();
    const req = httpMock.expectOne((candidate) => candidate.url === `${api}/admin/appointments/service-options`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('staffProfileId')).toBe('st-1');
    req.flush([]);
  });

  it('updates an appointment with an optional service and duration', () => {
    const request = {
      startsAtUtc: '2026-11-06T15:00:00.000Z',
      customerName: 'Juan',
      generalServiceId: 'g-beard',
      durationMinutes: 50,
    };
    service.update('a-1', request).subscribe();
    const req = httpMock.expectOne(`${api}/admin/appointments/a-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });
});
