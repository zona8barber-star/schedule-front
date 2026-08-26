import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { PermissionView, RoleView } from '../../../../../core/models/role.models';
import { AdminRolesListPageComponent } from './admin-roles-list-page.component';

describe('AdminRolesListPageComponent', () => {
  let fixture: ComponentFixture<AdminRolesListPageComponent>;
  let httpMock: HttpTestingController;

  const permissions: PermissionView[] = [
    { id: 'perm-1', code: 'sales.register', description: 'Registrar ventas' },
  ];

  const roles: RoleView[] = [
    { id: 'role-admin', name: 'Admin', isSystemRole: true, permissions },
    { id: 'role-1', name: 'Vendedor', isSystemRole: false, permissions },
  ];

  /**
   * `load()` awaits `Promise.all([firstValueFrom(...), firstValueFrom(...)])`, and `deleteRole()`
   * awaits `confirmModal.confirm(...)` before issuing its HTTP call. Each extra `await` hop needs
   * its own microtask tick to settle; `fixture.whenStable()` alone doesn't drain enough of them for
   * multi-hop chains like this. A `setTimeout` macrotask only fires once the microtask queue
   * (including chained awaits) has drained, so it reliably flushes everything pending.
   */
  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [AdminRolesListPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRolesListPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/roles`).flush(roles);
    httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/permissions`).flush(permissions);
    await fixture.whenStable();
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('renders every role and hides edit/delete for the system role', async () => {
    await createFixture();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Admin');
    expect(fixture.nativeElement.textContent).toContain('Vendedor');

    const editButtons = fixture.nativeElement.querySelectorAll('.roles__action-btn--edit');
    expect(editButtons.length).toBe(1);
  });

  it('deleteRole confirms, calls DELETE, and removes the row', async () => {
    await createFixture();

    (fixture.componentInstance as any)['confirmModal'].confirm = async () => true;

    const deletePromise = fixture.componentInstance.deleteRole(roles[1]);
    await flushMicrotasks();
    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/roles/role-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await deletePromise;

    expect(fixture.componentInstance.roles().some((r) => r.id === 'role-1')).toBe(false);
  });

  it('onSaved appends a newly created role and closes the modal', async () => {
    await createFixture();

    const created: RoleView = { id: 'role-2', name: 'Soporte', isSystemRole: false, permissions: [] };
    fixture.componentInstance.openCreate();
    fixture.componentInstance.onSaved(created);

    expect(fixture.componentInstance.isModalOpen()).toBe(false);
    expect(fixture.componentInstance.roles().some((r) => r.id === 'role-2')).toBe(true);
  });
});
