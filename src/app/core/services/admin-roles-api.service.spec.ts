import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { PermissionView, RoleView } from '../models/role.models';
import { AdminRolesApiService } from './admin-roles-api.service';

describe('AdminRolesApiService', () => {
  let service: AdminRolesApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/roles`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminRolesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list calls GET on the roles base URL', () => {
    service.list().subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([] as RoleView[]);
  });

  it('create calls POST with the request body', () => {
    const request = { name: 'Vendedor', permissionIds: ['perm-1'] };
    service.create(request).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({} as RoleView);
  });

  it('update calls PUT on /{id} with the request body', () => {
    const request = { name: 'Vendedor Senior', permissionIds: [] };
    service.update('role-1', request).subscribe();
    const req = httpMock.expectOne(`${base}/role-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({} as RoleView);
  });

  it('remove calls DELETE on /{id}', () => {
    service.remove('role-1').subscribe();
    const req = httpMock.expectOne(`${base}/role-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('listPermissions calls GET on /admin/permissions', () => {
    service.listPermissions().subscribe();
    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/permissions`);
    expect(req.request.method).toBe('GET');
    req.flush([] as PermissionView[]);
  });
});
