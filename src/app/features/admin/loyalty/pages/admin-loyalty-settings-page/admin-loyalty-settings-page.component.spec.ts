import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { LoyaltySettingsChangeView, LoyaltySettingsView } from '../../../../../core/models/loyalty.models';
import { AdminLoyaltySettingsPageComponent } from './admin-loyalty-settings-page.component';

describe('AdminLoyaltySettingsPageComponent', () => {
  let fixture: ComponentFixture<AdminLoyaltySettingsPageComponent>;
  let component: AdminLoyaltySettingsPageComponent;
  let httpMock: HttpTestingController;
  const settingsUrl = `${environment.defaultApiBaseUrl}/admin/loyalty/settings`;

  const defaults: LoyaltySettingsView = {
    isEnabled: false,
    pointsValidityDays: 365,
    version: 700,
    updatedAt: null,
    updatedByName: null,
    redemptionApprovalDays: 30,
    redemptionDeliveryDays: 30,
  };

  const change: LoyaltySettingsChangeView = {
    id: 'c-1',
    changedAt: '2026-11-03T15:00:00Z',
    changedByUserId: 'u-1',
    changedByName: 'Admin',
    previousIsEnabled: false,
    newIsEnabled: true,
    previousPointsValidityDays: 365,
    newPointsValidityDays: 90,
    previousRedemptionApprovalDays: null,
    newRedemptionApprovalDays: null,
    previousRedemptionDeliveryDays: null,
    newRedemptionDeliveryDays: null,
  };

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function open(settings = defaults, changes: LoyaltySettingsChangeView[] = []): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminLoyaltySettingsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLoyaltySettingsPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(settingsUrl).flush(settings);
    httpMock.expectOne(`${settingsUrl}/changes`).flush(changes);
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the current global settings and an empty history', async () => {
    await open();

    expect(component.form.getRawValue()).toEqual({
      isEnabled: false,
      pointsValidityDays: 365,
      redemptionApprovalDays: 30,
      redemptionDeliveryDays: 30,
    });
    expect(fixture.nativeElement.textContent).toContain('Aún no se ha modificado la configuración.');
    expect(fixture.nativeElement.textContent).toContain('sus puntos quedan reservados, empezando por los que vencen antes');
  });

  it('saves the validity and status with the version it loaded, then refreshes the history', async () => {
    await open();
    component.form.patchValue({ isEnabled: true, pointsValidityDays: 90 });

    const submitting = component.submit();
    const req = httpMock.expectOne(settingsUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      isEnabled: true,
      pointsValidityDays: 90,
      version: 700,
      redemptionApprovalDays: 30,
      redemptionDeliveryDays: 30,
    });
    req.flush({ ...defaults, isEnabled: true, pointsValidityDays: 90, version: 701, updatedAt: change.changedAt, updatedByName: 'Admin' });
    await flushMicrotasks();
    httpMock.expectOne(`${settingsUrl}/changes`).flush([change]);
    await submitting;
    fixture.detectChanges();

    expect(component.successMessage()).toBe('Configuración guardada.');
    expect(component.settings()?.version).toBe(701);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Estado: Deshabilitado → Habilitado');
    expect(text).toContain('Vigencia: 365 → 90 días');
  });

  it('does not call the API with an invalid validity', async () => {
    await open();

    for (const invalid of [0, -5, 3651, 12.5]) {
      component.form.patchValue({ pointsValidityDays: invalid });
      await component.submit();
      expect(component.form.controls.pointsValidityDays.invalid).toBe(true);
    }
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresa un número entero de días entre 1 y 3650.');
    httpMock.expectNone((request) => request.method === 'PUT');
  });

  it('on a conflict keeps the edited values, explains it and reloads the current ones on demand', async () => {
    await open();
    component.form.patchValue({ pointsValidityDays: 30 });

    const submitting = component.submit();
    httpMock.expectOne(settingsUrl).flush(
      { detail: 'La configuración de fidelización fue modificada por otra persona. Recarga para ver los valores actuales e intenta de nuevo.' },
      { status: 409, statusText: 'Conflict' },
    );
    await submitting;
    fixture.detectChanges();

    expect(component.hasConflict()).toBe(true);
    expect(component.errorMessage()).toContain('modificada por otra persona');
    expect(component.form.controls.pointsValidityDays.value).toBe(30);

    const reloadButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (button) => button.textContent?.trim() === 'Recargar valores actuales',
    );
    expect(reloadButton).toBeTruthy();
    reloadButton!.click();
    httpMock.expectOne(settingsUrl).flush({ ...defaults, pointsValidityDays: 120, version: 705 });
    httpMock.expectOne(`${settingsUrl}/changes`).flush([]);
    await flushMicrotasks();

    expect(component.hasConflict()).toBe(false);
    expect(component.errorMessage()).toBeNull();
    expect(component.form.controls.pointsValidityDays.value).toBe(120);
    expect(component.settings()?.version).toBe(705);
  });

  it('shows the validation message returned by the API', async () => {
    await open();

    const submitting = component.submit();
    httpMock.expectOne(settingsUrl).flush(
      { errors: { pointsValidityDays: ['La vigencia de los puntos debe ser un número entero de días entre 1 y 3650.'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await submitting;

    expect(component.hasConflict()).toBe(false);
    expect(component.errorMessage()).toBe('La vigencia de los puntos debe ser un número entero de días entre 1 y 3650.');
  });
  it('explains a revoked permission instead of showing an empty history', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLoyaltySettingsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminLoyaltySettingsPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(settingsUrl).flush(null, { status: 403, statusText: 'Forbidden' });
    httpMock.expectOne(`${settingsUrl}/changes`).flush(null, { status: 403, statusText: 'Forbidden' });
    await flushMicrotasks();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(component.errorMessage()).toContain('Ya no tienes permiso para administrar la fidelización');
    expect(text).toContain('No se pudo cargar el historial.');
    expect(text).not.toContain('Aún no se ha modificado la configuración.');
  });
});
