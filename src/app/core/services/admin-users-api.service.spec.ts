import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AdminUserItem } from '../models/admin-user.models';
import { AdminUsersApiService } from './admin-users-api.service';

describe('AdminUsersApiService', () => {
  let service: AdminUsersApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/users`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminUsersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list calls GET on the users base URL', () => {
    service.list().subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([] as AdminUserItem[]);
  });

  it('getById calls GET on /{id}', () => {
    service.getById('user-1').subscribe();
    const req = httpMock.expectOne(`${base}/user-1`);
    expect(req.request.method).toBe('GET');
    req.flush({} as AdminUserItem);
  });

  it('update calls PUT on /{id} with the request body', () => {
    const request = { fullName: 'Juan Actualizado', phoneNumber: '999888777' };
    service.update('user-1', request).subscribe();
    const req = httpMock.expectOne(`${base}/user-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({} as AdminUserItem);
  });

  it('deactivate calls DELETE on /{id}', () => {
    service.deactivate('user-1').subscribe();
    const req = httpMock.expectOne(`${base}/user-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('updateCustomRoles calls PATCH on /{id}/roles with the request body', () => {
    const request = { roleIds: ['role-1', 'role-2'] };
    service.updateCustomRoles('user-1', request).subscribe();
    const req = httpMock.expectOne(`${base}/user-1/roles`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(request);
    req.flush({} as AdminUserItem);
  });
});
