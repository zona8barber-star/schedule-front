import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { PublicAvailabilityApiService } from './public-availability-api.service';

describe('PublicAvailabilityApiService', () => {
  let service: PublicAvailabilityApiService;
  let httpMock: HttpTestingController;
  const url = `${environment.defaultApiBaseUrl}/public/staff/st-1/availability/slots`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublicAvailabilityApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('asks for the slots of a general service', () => {
    service.getSlots('st-1', '2026-11-06', '2026-11-19', { generalServiceId: 'g-cut' }).subscribe();

    const req = httpMock.expectOne((candidate) => candidate.url === url);
    expect(req.request.params.get('from')).toBe('2026-11-06');
    expect(req.request.params.get('to')).toBe('2026-11-19');
    expect(req.request.params.get('generalServiceId')).toBe('g-cut');
    expect(req.request.params.has('durationMinutes')).toBe(false);
    req.flush({ staffProfileId: 'st-1', from: '', to: '', slotDurationMinutes: 30, slots: [], generalServiceId: 'g-cut', slotStepMinutes: 15 });
  });

  it('asks for the slots of a plain duration (rescheduling)', () => {
    service.getSlots('st-1', '2026-11-06', '2026-11-06', { durationMinutes: 45 }).subscribe();

    const req = httpMock.expectOne((candidate) => candidate.url === url);
    expect(req.request.params.get('durationMinutes')).toBe('45');
    expect(req.request.params.has('generalServiceId')).toBe(false);
    req.flush({ staffProfileId: 'st-1', from: '', to: '', slotDurationMinutes: 45, slots: [], generalServiceId: null, slotStepMinutes: 15 });
  });
});
