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
   * `loadUsers()` awaits `Promise.allSettled([firstValueFrom(...), firstValueFrom(...)])`, and
   * `saveEdit()` awaits an optional PUT before firing a PATCH. Each extra `await` hop needs its
   * own microtask tick to settle; `fixture.whenStable()` alone doesn't reliably drain multi-hop
   * chains like this. A `setTimeout` macrotask only fires once the microtask queue (including
   * chained awaits) has drained, so it reliably flushes everything pending.
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

  it('saveEdit skips the profile PUT and only PATCHes custom roles when the form is untouched', async () => {
    await createFixture();
    fixture.componentInstance.openEdit(user);
    fixture.componentInstance.toggleCustomRole('role-1');

    // openEdit() calls editForm.reset(...), which marks the form pristine. Toggling a role
    // checkbox is not form-bound, so the form stays pristine — the PUT must be skipped
    // entirely to avoid wiping backend-only fields (e.g. DateOfBirth) on a role-only edit.
    expect(fixture.componentInstance.editForm.pristine).toBe(true);

    const savePromise = fixture.componentInstance.saveEdit();
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

    httpMock.expectNone(`${environment.defaultApiBaseUrl}/admin/users/user-1`);
  });

  it('saveEdit PUTs the profile fields first, then PATCHes custom roles, when the form is dirty', async () => {
    await createFixture();
    fixture.componentInstance.openEdit(user);
    fixture.componentInstance.editForm.patchValue({ fullName: 'Juan Editado' });
    // patchValue() alone does not mark a control dirty — only user interaction (or an
    // explicit markAsDirty()) does. Real typing in the bound <input> would dirty it via
    // the FormControlDirective's view-to-model update, so simulate that here.
    fixture.componentInstance.editForm.controls.fullName.markAsDirty();
    fixture.componentInstance.toggleCustomRole('role-1');

    expect(fixture.componentInstance.editForm.dirty).toBe(true);

    const savePromise = fixture.componentInstance.saveEdit();
    await flushMicrotasks();

    const putReq = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/users/user-1`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ fullName: 'Juan Editado', phoneNumber: '123456789' });
    putReq.flush({ ...user, fullName: 'Juan Editado', customRoleIds: [] });
    await flushMicrotasks();

    const patchReq = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/users/user-1/roles`);
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({ roleIds: ['role-1'] });
    patchReq.flush({ ...user, fullName: 'Juan Editado', customRoleIds: ['role-1'] });

    await savePromise;
    await fixture.whenStable();
    await flushMicrotasks();

    expect(fixture.componentInstance.editingUser()).toBeNull();
    const updated = fixture.componentInstance.users().find((u) => u.userId === 'user-1');
    expect(updated?.fullName).toBe('Juan Editado');
    expect(updated?.customRoleIds).toEqual(['role-1']);
  });

  it('saveEdit keeps the PUT result visible and leaves the edit panel open when the PATCH fails after a dirty-form save', async () => {
    await createFixture();
    fixture.componentInstance.openEdit(user);
    fixture.componentInstance.editForm.patchValue({ fullName: 'Juan Editado' });
    fixture.componentInstance.editForm.controls.fullName.markAsDirty();

    const savePromise = fixture.componentInstance.saveEdit();
    await flushMicrotasks();

    const putReq = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/users/user-1`);
    putReq.flush({ ...user, fullName: 'Juan Editado', customRoleIds: [] });
    await flushMicrotasks();

    const patchReq = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/users/user-1/roles`);
    patchReq.flush({ message: 'No se pudo actualizar los roles' }, { status: 400, statusText: 'Bad Request' });

    await savePromise;
    await fixture.whenStable();
    await flushMicrotasks();

    // Partial success stays visible: the PUT already landed even though the overall save
    // "failed" on the subsequent PATCH.
    const updated = fixture.componentInstance.users().find((u) => u.userId === 'user-1');
    expect(updated?.fullName).toBe('Juan Editado');
    expect(fixture.componentInstance.editingUser()).not.toBeNull();
    expect(fixture.componentInstance.saveError()).toBeTruthy();
  });

  it('loadUsers still populates users() when /admin/roles fails', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsersListPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersListPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/users`).flush([user]);
    httpMock
      .expectOne(`${environment.defaultApiBaseUrl}/admin/roles`)
      .flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();
    await flushMicrotasks();
    fixture.detectChanges();

    expect(fixture.componentInstance.users().length).toBe(1);
    expect(fixture.componentInstance.customRoles()).toEqual([]);
  });
});
