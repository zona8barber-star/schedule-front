import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { LoyaltySettingsChangeView, LoyaltySettingsView } from '../models/loyalty.models';
import { AdminLoyaltyApiService } from './admin-loyalty-api.service';

describe('AdminLoyaltyApiService', () => {
  let service: AdminLoyaltyApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/loyalty/settings`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminLoyaltyApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getSettings calls GET on the settings URL', () => {
    service.getSettings().subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush({} as LoyaltySettingsView);
  });

  it('updateSettings calls PUT with the version it was given', () => {
    const request = { isEnabled: true, pointsValidityDays: 90, version: 812 };
    service.updateSettings(request).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({} as LoyaltySettingsView);
  });

  it('listSettingsChanges asks for one page of the changes', () => {
    service.listSettingsChanges({ page: 2, pageSize: 25 }).subscribe();
    const req = httpMock.expectOne(`${base}/changes?page=2&pageSize=25`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] as LoyaltySettingsChangeView[], page: 2, pageSize: 25, totalCount: 0 });
  });
});
