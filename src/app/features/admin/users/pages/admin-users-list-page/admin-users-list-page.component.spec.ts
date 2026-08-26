import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { AdminUserItem } from '../../../../../core/models/admin-user.models';
import { RoleView } from '../../../../../core/models/role.models';
import { AdminUsersListPageComponent } from './admin-users-list-page.component';

describe('AdminUsersListPageComponent', () => {
  let fixture: ComponentFixture<AdminUsersListPageComponent>;
  let httpMock: HttpTestingController;

  const user: AdminUserItem = {
    userId: 'user-1',
    fullName: 'Juan Barbero',
    email: 'juan@example.com',
    phoneNumber: '123456789',
    roles: ['Staff'],
    customRoleIds: [],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const sellerRole: RoleView = {
    id: 'role-1',
    name: 'Vendedor',
    isSystemRole: false,
    permissions: [],
  };

  /**
   * `loadUsers()` awaits `Promise.all([firstValueFrom(...), firstValueFrom(...)])`, and `saveEdit()`
   * awaits a PUT before firing a PATCH. Each extra `await` hop needs its own microtask tick to
   * settle; `fixture.whenStable()` alone doesn't reliably drain multi-hop chains like this. A
   * `setTimeout` macrotask only fires once the microtask queue (including chained awaits) has
   * drained, so it reliably flushes everything pending.
   */
  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [AdminUsersListPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersListPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/users`).flush([user]);
    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/roles`).flush([sellerRole]);
    await fixture.whenStable();
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('loads users and the custom role catalog', async () => {
    await createFixture();

    expect(fixture.componentInstance.users().length).toBe(1);
    expect(fixture.componentInstance.customRoles().length).toBe(1);
  });

  it('openEdit seeds selectedCustomRoleIds from the user customRoleIds', async () => {
    await createFixture();
    const userWithRole = { ...user, customRoleIds: ['role-1'] };

    fixture.componentInstance.openEdit(userWithRole);

    expect(fixture.componentInstance.isCustomRoleSelected('role-1')).toBe(true);
  });

  it('saveEdit PUTs the profile fields, then PATCHes the selected custom roles', async () => {
    await createFixture();
    fixture.componentInstance.openEdit(user);
    fixture.componentInstance.toggleCustomRole('role-1');

    const savePromise = fixture.componentInstance.saveEdit();
    await flushMicrotasks();

    const putReq = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/users/user-1`);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ ...user, customRoleIds: [] });
    await flushMicrotasks();

    const patchReq = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/users/user-1/roles`);
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({ roleIds: ['role-1'] });
    patchReq.flush({ ...user, customRoleIds: ['role-1'] });

    await savePromise;
    await fixture.whenStable();
    await flushMicrotasks();

    expect(fixture.componentInstance.editingUser()).toBeNull();
    const updated = fixture.componentInstance.users().find((u) => u.userId === 'user-1');
    expect(updated?.customRoleIds).toEqual(['role-1']);
  });
});
