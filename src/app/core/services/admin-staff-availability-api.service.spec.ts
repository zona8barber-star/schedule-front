import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  AvailabilityRule,
  AvailabilitySummary,
  UnavailablePeriod,
} from '../models/availability.models';
import { AdminStaffAvailabilityApiService } from './admin-staff-availability-api.service';

describe('AdminStaffAvailabilityApiService', () => {
  let service: AdminStaffAvailabilityApiService;
  let httpMock: HttpTestingController;
  const staffId = '11111111-1111-1111-1111-111111111111';
  const base = `${environment.defaultApiBaseUrl}/admin/staff/${staffId}/availability`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminStaffAvailabilityApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getSummary calls GET on the availability base URL', () => {
    service.getSummary(staffId).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush({} as AvailabilitySummary);
  });

  it('updateWeeklyRules calls PUT on /rules with the request body', () => {
    const request = [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }];
    service.updateWeeklyRules(staffId, request).subscribe();
    const req = httpMock.expectOne(`${base}/rules`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush([] as AvailabilityRule[]);
  });

  it('listUnavailablePeriods calls GET on /unavailable-periods', () => {
    service.listUnavailablePeriods(staffId).subscribe();
    const req = httpMock.expectOne(`${base}/unavailable-periods`);
    expect(req.request.method).toBe('GET');
    req.flush([] as UnavailablePeriod[]);
  });

  it('createUnavailablePeriod calls POST on /unavailable-periods', () => {
    const request = { startsAtUtc: '2026-09-01T00:00:00Z', endsAtUtc: '2026-09-02T00:00:00Z', reason: null };
    service.createUnavailablePeriod(staffId, request).subscribe();
    const req = httpMock.expectOne(`${base}/unavailable-periods`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({} as UnavailablePeriod);
  });

  it('updateUnavailablePeriod calls PUT on /unavailable-periods/:id', () => {
    const periodId = '22222222-2222-2222-2222-222222222222';
    const request = { startsAtUtc: '2026-09-01T00:00:00Z', endsAtUtc: '2026-09-02T00:00:00Z', reason: 'x' };
    service.updateUnavailablePeriod(staffId, periodId, request).subscribe();
    const req = httpMock.expectOne(`${base}/unavailable-periods/${periodId}`);
    expect(req.request.method).toBe('PUT');
    req.flush({} as UnavailablePeriod);
  });

  it('deleteUnavailablePeriod calls DELETE on /unavailable-periods/:id', () => {
    const periodId = '22222222-2222-2222-2222-222222222222';
    service.deleteUnavailablePeriod(staffId, periodId).subscribe();
    const req = httpMock.expectOne(`${base}/unavailable-periods/${periodId}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
