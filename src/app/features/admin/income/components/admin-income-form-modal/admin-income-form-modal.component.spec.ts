import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { IncomeEntryView } from '../../../../../core/models/income.models';
import { AdminIncomeFormModalComponent } from './admin-income-form-modal.component';
import { MoneyConfirmationService } from '../../../../../core/services/money-confirmation.service';

describe('AdminIncomeFormModalComponent', () => {
  let fixture: ComponentFixture<AdminIncomeFormModalComponent>;
  let component: AdminIncomeFormModalComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;
  let confirmAnswer = true;
  const moneyConfirmation = { confirm: vi.fn(() => Promise.resolve(confirmAnswer)) };

  const services = [
    { id: 's-1', name: 'Corte', basePrice: 25000, businessPercentage: 40, isActive: true, createdAt: '', updatedAt: null },
  ];
  const staff = [{ staffProfileId: 'st-1', displayName: 'Alex', isActive: true }];

  const sale: IncomeEntryView = {
    id: 'i-2',
    kind: 'MembershipSale',
    serviceId: null,
    serviceName: null,
    basePrice: 0,
    staffProfileId: null,
    staffDisplayName: null,
    amount: 250000,
    isPromo: false,
    businessPercentage: 100,
    businessAmount: 250000,
    professionalAmount: 0,
    occurredOn: '2026-06-10',
    createdAt: '',
    updatedAt: null,
  };

  /** ngOnInit awaits Promise.all over two requests; the continuation needs a macrotask to run. */
  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function open(entry: IncomeEntryView | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminIncomeFormModalComponent],
      providers: [
        // Saving money values asks for confirmation (BUG-080 decision); these specs cover the save itself.
        { provide: MoneyConfirmationService, useValue: moneyConfirmation },
        provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminIncomeFormModalComponent);
    component = fixture.componentInstance;
    component.entry = entry;
    component.defaultDate = '2026-06-10';
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${api}/admin/services/options`).flush(services);
    httpMock.expectOne(`${api}/admin/staff`).flush(staff);
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    confirmAnswer = true;
    moneyConfirmation.confirm.mockClear();
    httpMock.verify();
  });

  it('registers service income by default, with kind, service and professional', async () => {
    await open(null);
    component.form.patchValue({ serviceId: 's-1', staffProfileId: 'st-1', amount: 25000 });

    const saving = component.submit();
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // the amount confirmation resolves first
    const req = httpMock.expectOne(`${api}/admin/income`);
    expect(req.request.body).toEqual({
      kind: 'Service',
      serviceId: 's-1',
      staffProfileId: 'st-1',
      amount: 25000,
      isPromo: false,
      occurredOn: '2026-06-10',
    });
    req.flush({});
    await saving;
  });

  it('registers a membership sale without service, professional or promo', async () => {
    await open(null);
    component.form.controls.kind.setValue('MembershipSale');
    component.onKindChange('MembershipSale');
    component.form.patchValue({ amount: 250000 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('select[formcontrolname="serviceId"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('select[formcontrolname="staffProfileId"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('no genera comisión');
    // The service-only fields no longer block saving.
    expect(component.form.valid).toBe(true);

    const saving = component.submit();
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // the amount confirmation resolves first
    const req = httpMock.expectOne(`${api}/admin/income`);
    expect(req.request.body).toEqual({
      kind: 'MembershipSale',
      serviceId: null,
      staffProfileId: null,
      amount: 250000,
      isPromo: false,
      occurredOn: '2026-06-10',
    });
    req.flush(sale);
    await saving;
  });

  it('still requires a service and professional for service income', async () => {
    await open(null);
    component.form.patchValue({ amount: 25000 });

    await component.submit();

    httpMock.expectNone(`${api}/admin/income`);
    expect(component.form.controls.serviceId.invalid).toBe(true);
    expect(component.form.controls.staffProfileId.invalid).toBe(true);
  });

  it('keeps the kind of an existing entry fixed when editing', async () => {
    await open(sale);

    expect(component.form.controls.kind.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('el tipo no se puede cambiar');
    expect(fixture.nativeElement.querySelector('input[type="radio"]')).toBeNull();

    component.form.patchValue({ amount: 300000 });
    const saving = component.submit();
    await new Promise<void>((resolve) => setTimeout(resolve, 0)); // the amount confirmation resolves first
    const req = httpMock.expectOne(`${api}/admin/income/i-2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.kind).toBe('MembershipSale');
    expect(req.request.body.amount).toBe(300000);
    expect(req.request.body.serviceId).toBeNull();
    req.flush(sale);
    await saving;
  });

  describe('amount confirmation (BUG-080 decision)', () => {
    it('asks to confirm the amount before registering the income', async () => {
      await open(null);
      component.form.patchValue({ serviceId: 's-1', staffProfileId: 'st-1', amount: 3_500_000 });

      const saving = component.submit();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(moneyConfirmation.confirm).toHaveBeenCalledWith({ action: 'Registrar ingreso', amount: 3_500_000 });
      httpMock.expectOne(`${api}/admin/income`).flush({ ...sale, id: 'i-3', kind: 'Service', amount: 3_500_000 });
      await saving;
    });

    it('does not save when the admin goes back to edit', async () => {
      await open(null);
      component.form.patchValue({ serviceId: 's-1', staffProfileId: 'st-1', amount: 35_000_000 });
      confirmAnswer = false;

      await component.submit();

      httpMock.expectNone(`${api}/admin/income`);
      expect(component.isSaving()).toBe(false);
    });
  });

  /** SONDA BUG-104: a linked membership sale whose new amount no longer matches asks for a justification. */
  it('asks for the justification the API requires and sends it on the next save', async () => {
    await open(sale);
    component.form.patchValue({ amount: 1 });

    const first = component.submit();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    httpMock.expectOne(`${api}/admin/income/i-2`).flush(
      { errors: { discrepancyJustification: ['El valor del ingreso (1) no coincide con la suma de las membresías vinculadas (250.000). Explica la diferencia.'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await first;
    fixture.detectChanges();

    expect(component.justificationRequest()).toContain('Explica la diferencia');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="discrepancy-justification"]')).not.toBeNull();

    component.form.controls.discrepancyJustification.setValue('Cortesía acordada');
    const second = component.submit();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const retry = httpMock.expectOne(`${api}/admin/income/i-2`);
    expect(retry.request.body.discrepancyJustification).toBe('Cortesía acordada');
    retry.flush({ ...sale, amount: 1 });
    await second;
  });
});
