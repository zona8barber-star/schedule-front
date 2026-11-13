import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { PERMISSION_CODES, PermissionCode } from '../../../../../core/models/auth.models';
import { GeneralServiceView } from '../../../../../core/models/service-catalog.models';
import { ServiceView } from '../../../../../core/models/service.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { AdminServiceFormModalComponent } from './admin-service-form-modal.component';
import { MoneyConfirmationService } from '../../../../../core/services/money-confirmation.service';

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
    generalServiceId: 'g-cut',
    generalServiceName: 'Corte',
    generalServiceIsActive: true,
    categoryId: 'c-barber',
    categoryName: 'Barbería',
  };

  function general(id: string, name: string, categoryName: string, isActive = true): GeneralServiceView {
    return {
      id, categoryId: `c-${categoryName}`, categoryName, categoryIsActive: true, name, description: null, sortOrder: 0,
      publicCode: `${id}code`, isActive, rateCount: 0, activeRateCount: 0, createdAt: '', updatedAt: null,
    };
  }

  const generalServices: GeneralServiceView[] = [
    general('g-cut', 'Corte', 'Barbería'),
    general('g-beard', 'Barba', 'Barbería'),
    general('g-old', 'Tinte', 'Barbería', false),
    general('g-face', 'Limpieza facial', 'Cuidado facial'),
  ];

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function open(serviceId: string | null, permissions: PermissionCode[] = []): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminServiceFormModalComponent],
      providers: [
        // Saving money values asks for confirmation (BUG-080 decision); these specs cover the save itself.
        { provide: MoneyConfirmationService, useValue: { confirm: () => Promise.resolve(true) } },
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

    httpMock.expectOne(`${api}/admin/general-services`).flush(generalServices);
    if (serviceId) {
      httpMock.expectOne(`${api}/admin/services/${serviceId}`).flush(haircut);
    }
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('creates a service with its loyalty points when the user manages loyalty', async () => {
    await open(null, [PERMISSION_CODES.loyaltySettingsManage]);
    component.form.patchValue({ generalServiceId: 'g-beard', name: 'Barba', basePrice: 15000, businessPercentage: 30, loyaltyPoints: 8 });

    const submitting = component.submit();
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // the amount confirmation resolves first
    const req = httpMock.expectOne(`${api}/admin/services`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ generalServiceId: 'g-beard', name: 'Barba', basePrice: 15000, businessPercentage: 30, loyaltyPoints: 8 });
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
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // the amount confirmation resolves first
    const req = httpMock.expectOne(`${api}/admin/services/s-cut`);
    expect(req.request.body).toEqual({ generalServiceId: 'g-cut', name: 'Corte clásico', basePrice: 25000, businessPercentage: 30 });
    req.flush({ ...haircut, name: 'Corte clásico' });
    await submitting;
  });

  it('shows the message of a forbidden points change', async () => {
    await open('s-cut', [PERMISSION_CODES.loyaltySettingsManage]);
    component.form.patchValue({ loyaltyPoints: 20 });

    const submitting = component.submit();
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // the amount confirmation resolves first
    httpMock.expectOne(`${api}/admin/services/s-cut`).flush(
      { detail: 'No tienes permiso para configurar los puntos de fidelización.' },
      { status: 403, statusText: 'Forbidden' },
    );
    await submitting;

    expect(component.errorMessage()).toBe('No tienes permiso para configurar los puntos de fidelización.');
  });

  it('requires a general service for a new rate and offers the active ones grouped by category', async () => {
    await open(null, [PERMISSION_CODES.loyaltySettingsManage]);
    component.form.patchValue({ name: 'Barba', basePrice: 15000, businessPercentage: 30 });

    await component.submit();
    fixture.detectChanges();

    expect(component.form.controls.generalServiceId.invalid).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Elige el servicio general al que pertenece la tarifa.');
    httpMock.expectNone(`${api}/admin/services`);
    const groups = component.generalServiceGroups().map((group) => [group.categoryName, group.options.map((option) => option.id)]);
    expect(groups).toEqual([
      ['Barbería', ['g-cut', 'g-beard']],
      ['Cuidado facial', ['g-face']],
    ]);
  });

  it('keeps the current general service selectable when it is inactive, and can move the rate', async () => {
    haircut.generalServiceId = 'g-old';
    try {
      await open('s-cut', [PERMISSION_CODES.loyaltySettingsManage]);
    } finally {
      haircut.generalServiceId = 'g-cut';
    }

    expect(component.form.controls.generalServiceId.value).toBe('g-old');
    expect(component.generalServiceGroups()[0].options.map((option) => option.id)).toEqual(['g-cut', 'g-beard', 'g-old']);
    expect(fixture.nativeElement.textContent).toContain('Tinte (inactivo)');

    component.form.patchValue({ generalServiceId: 'g-face' });
    const submitting = component.submit();
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // the amount confirmation resolves first
    const req = httpMock.expectOne(`${api}/admin/services/s-cut`);
    expect(req.request.body.generalServiceId).toBe('g-face');
    req.flush({ ...haircut, generalServiceId: 'g-face' });
    await submitting;
  });
});
