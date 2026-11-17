import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthUserResponse, PERMISSION_CODES, PermissionCode } from '../models/auth.models';
import { AuthService } from './auth.service';
import { ServiceRecordsPendingService } from './service-records-pending.service';

describe('ServiceRecordsPendingService', () => {
  let httpMock: HttpTestingController;
  const user = signal<AuthUserResponse | null>(null);
  let granted: PermissionCode[] = [];
  const url = `${environment.defaultApiBaseUrl}/admin/service-records/pending-count`;

  function setup(): ServiceRecordsPendingService {
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
    return TestBed.inject(ServiceRecordsPendingService);
  }

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  afterEach(() => {
    httpMock.verify();
    user.set(null);
    granted = [];
  });

  it('asks once per reviewer and reads again after a review', async () => {
    granted = [PERMISSION_CODES.serviceRecordsApprove];
    user.set({ id: 'u-admin', roles: ['Admin'] } as unknown as AuthUserResponse);
    const service = setup();
    TestBed.tick();

    httpMock.expectOne(url).flush({ count: 2 });
    await settle();
    expect(service.hasPending()).toBe(true);
    TestBed.tick();
    httpMock.expectNone(url);

    const refresh = service.refresh();
    httpMock.expectOne(url).flush({ count: 0 });
    await refresh;
    expect(service.hasPending()).toBe(false);
  });

  it('never asks without service-records.approve', () => {
    user.set({ id: 'u-staff', roles: ['Staff'] } as unknown as AuthUserResponse);
    const service = setup();
    TestBed.tick();

    httpMock.expectNone(url);
    expect(service.hasPending()).toBe(false);
  });
});
