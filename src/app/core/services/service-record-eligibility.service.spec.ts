import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthUserResponse, PERMISSION_CODES, PermissionCode } from '../models/auth.models';
import { AuthService } from './auth.service';
import { ServiceRecordEligibilityService } from './service-record-eligibility.service';

describe('ServiceRecordEligibilityService', () => {
  let httpMock: HttpTestingController;
  const user = signal<AuthUserResponse | null>(null);
  let granted: PermissionCode[] = [];
  const url = `${environment.defaultApiBaseUrl}/staff/service-records/eligibility`;

  function setup(): ServiceRecordEligibilityService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser: user.asReadonly(), hasPermission: (code: PermissionCode) => granted.includes(code) },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(ServiceRecordEligibilityService);
  }

  afterEach(() => {
    httpMock.verify();
    user.set(null);
    granted = [];
  });

  it('asks the API once per user with the permission, whatever the role', async () => {
    granted = [PERMISSION_CODES.serviceRecordsRegister];
    user.set({ id: 'u-admin', roles: ['Admin'] } as unknown as AuthUserResponse);
    const service = setup();
    TestBed.tick();

    httpMock.expectOne(url).flush({ hasStaffProfile: true, staffProfileId: 'st-1', displayName: 'Admin' });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(service.canRegister()).toBe(true);

    TestBed.tick();
    httpMock.expectNone(url);
  });

  it('never asks without the permission', () => {
    user.set({ id: 'u-customer', roles: ['Customer'] } as unknown as AuthUserResponse);
    const service = setup();
    TestBed.tick();

    httpMock.expectNone(url);
    expect(service.canRegister()).toBe(false);
  });
});
