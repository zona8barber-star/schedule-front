import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { PermissionView, RoleView } from '../../../../../core/models/role.models';
import { AdminRoleFormModalComponent } from './admin-role-form-modal.component';

describe('AdminRoleFormModalComponent', () => {
  let fixture: ComponentFixture<AdminRoleFormModalComponent>;
  let httpMock: HttpTestingController;

  const permissions: PermissionView[] = [
    { id: 'perm-1', code: 'inventory.view', description: 'Ver existencias, costos y ganancia de productos' },
  ];

  const existingRole: RoleView = {
    id: 'role-1',
    name: 'Vendedor',
    isSystemRole: false,
    permissions: [permissions[0]],
  };

  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [AdminRoleFormModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRoleFormModalComponent);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('starts empty with no permission selected, in create mode', async () => {
    await createFixture();
    fixture.componentRef.setInput('role', null);
    fixture.componentRef.setInput('permissions', permissions);
    fixture.detectChanges();

    expect(fixture.componentInstance.isEditing).toBe(false);
    expect(fixture.componentInstance.form.controls.name.value).toBe('');
    expect(fixture.componentInstance.isSelected('perm-1')).toBe(false);
  });

  it('pre-fills name and selected permissions when editing', async () => {
    await createFixture();
    fixture.componentRef.setInput('role', existingRole);
    fixture.componentRef.setInput('permissions', permissions);
    fixture.detectChanges();

    expect(fixture.componentInstance.isEditing).toBe(true);
    expect(fixture.componentInstance.form.controls.name.value).toBe('Vendedor');
    expect(fixture.componentInstance.isSelected('perm-1')).toBe(true);
  });

  it('submit in create mode POSTs the selected permission ids', async () => {
    await createFixture();
    fixture.componentRef.setInput('role', null);
    fixture.componentRef.setInput('permissions', permissions);
    fixture.detectChanges();

    fixture.componentInstance.form.controls.name.setValue('Vendedor');
    fixture.componentInstance.togglePermission('perm-1');

    const submitPromise = fixture.componentInstance.submit();
    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/roles`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Vendedor', permissionIds: ['perm-1'] });
    req.flush(existingRole);

    await submitPromise;
  });

  it('submit in edit mode PUTs to /{id} and toggling off removes the permission', async () => {
    await createFixture();
    fixture.componentRef.setInput('role', existingRole);
    fixture.componentRef.setInput('permissions', permissions);
    fixture.detectChanges();

    fixture.componentInstance.togglePermission('perm-1');

    const submitPromise = fixture.componentInstance.submit();
    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/roles/role-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'Vendedor', permissionIds: [], version: null });
    req.flush({ ...existingRole, permissions: [] });

    await submitPromise;
  });

  // SONDA BUG-161: the version read goes back with the save, so a change made meanwhile is a 409 (shown in the modal).
  it('sends the version of the role it edits and shows the conflict when someone changed it', async () => {
    await createFixture();
    fixture.componentRef.setInput('role', { ...existingRole, version: '4711' });
    fixture.componentRef.setInput('permissions', permissions);
    fixture.detectChanges();

    const submitPromise = fixture.componentInstance.submit();
    const req = httpMock.expectOne(`${environment.defaultApiBaseUrl}/admin/roles/role-1`);
    expect(req.request.body.version).toBe('4711');
    req.flush(
      { title: 'Conflicto', status: 409, detail: 'Otra persona cambió este rol mientras lo editabas. Recarga la página para ver sus permisos actuales y vuelve a guardar.' },
      { status: 409, statusText: 'Conflict' },
    );
    await submitPromise;

    expect(fixture.componentInstance.errorMessage()).toContain('Otra persona cambió este rol');
  });
});
