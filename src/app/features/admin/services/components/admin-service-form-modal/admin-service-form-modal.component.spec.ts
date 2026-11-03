import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { PERMISSION_CODES, PermissionCode } from '../../../../../core/models/auth.models';
import { ServiceView } from '../../../../../core/models/service.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { AdminServiceFormModalComponent } from './admin-service-form-modal.component';

describe('AdminServiceFormModalComponent', () => {
  let fixture: ComponentFixture<AdminServiceFormModalComponent>;
  let component: AdminServiceFormModalComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const haircut: ServiceView = {
    id: 's-cut',
    name: 'Corte',
    basePrice: 25000,
    businessPercentage: 30,
    isActive: true,
    createdAt: '',
    updatedAt: null,
    loyaltyPoints: 15,
  };

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function open(serviceId: string | null, permissions: PermissionCode[] = []): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminServiceFormModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { hasPermission: (code: PermissionCode) => permissions.includes(code) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminServiceFormModalComponent);
    component = fixture.componentInstance;
    component.serviceId = serviceId;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    if (serviceId) {
      httpMock.expectOne(`${api}/admin/services/${serviceId}`).flush(haircut);
      await flushMicrotasks();
      fixture.detectChanges();
    }
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('creates a service with its loyalty points when the user manages loyalty', async () => {
    await open(null, [PERMISSION_CODES.loyaltySettingsManage]);
    component.form.patchValue({ name: 'Barba', basePrice: 15000, businessPercentage: 30, loyaltyPoints: 8 });

    const submitting = component.submit();
    const req = httpMock.expectOne(`${api}/admin/services`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Barba', basePrice: 15000, businessPercentage: 30, loyaltyPoints: 8 });
    req.flush({ ...haircut, id: 's-beard', name: 'Barba', loyaltyPoints: 8 });
    await submitting;
  });

  it('starts new services at zero points and accepts zero', async () => {
    await open(null, [PERMISSION_CODES.loyaltySettingsManage]);

    expect(component.form.controls.loyaltyPoints.value).toBe(0);
    expect(component.form.controls.loyaltyPoints.valid).toBe(true);
  });

  it('rejects negative, fractional and too large points before calling the API', async () => {
    await open('s-cut', [PERMISSION_CODES.loyaltySettingsManage]);

    for (const invalid of [-1, 1.5, 100001]) {
      component.form.patchValue({ loyaltyPoints: invalid });
      await component.submit();
      expect(component.form.controls.loyaltyPoints.invalid).toBe(true);
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Usa 0 si no otorga puntos.');
    httpMock.expectNone(`${api}/admin/services/s-cut`);
  });

  it('keeps the stored points out of the request without the loyalty permission', async () => {
    await open('s-cut');

    expect(component.form.controls.loyaltyPoints.disabled).toBe(true);
    expect(component.form.controls.loyaltyPoints.value).toBe(15);
    expect(fixture.nativeElement.textContent).toContain('Solo quien administra la fidelización puede cambiar los puntos.');

    component.form.patchValue({ name: 'Corte clásico' });
    const submitting = component.submit();
    const req = httpMock.expectOne(`${api}/admin/services/s-cut`);
    expect(req.request.body).toEqual({ name: 'Corte clásico', basePrice: 25000, businessPercentage: 30 });
    req.flush({ ...haircut, name: 'Corte clásico' });
    await submitting;
  });

  it('shows the message of a forbidden points change', async () => {
    await open('s-cut', [PERMISSION_CODES.loyaltySettingsManage]);
    component.form.patchValue({ loyaltyPoints: 20 });

    const submitting = component.submit();
    httpMock.expectOne(`${api}/admin/services/s-cut`).flush(
      { detail: 'No tienes permiso para configurar los puntos de fidelización.' },
      { status: 403, statusText: 'Forbidden' },
    );
    await submitting;

    expect(component.errorMessage()).toBe('No tienes permiso para configurar los puntos de fidelización.');
  });
});
