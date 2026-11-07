import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { StaffAppointmentsApiService } from './staff-appointments-api.service';

describe('StaffAppointmentsApiService', () => {
  let service: StaffAppointmentsApiService;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StaffAppointmentsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists the bookable offerings of the current professional', () => {
    service.serviceOptions().subscribe();
    const req = httpMock.expectOne(`${api}/staff/appointments/service-options`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('creates a manual appointment by service, without an end time', () => {
    const request = {
      startsAtUtc: '2026-11-06T15:00:00.000Z',
      generalServiceId: 'g-cut',
      customerName: 'Juan',
      customerEmail: null,
      customerPhone: null,
      notes: null,
    };
    service.createManual(request).subscribe();
    const req = httpMock.expectOne(`${api}/staff/appointments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect('endsAtUtc' in req.request.body).toBe(false);
    req.flush({});
  });
});
