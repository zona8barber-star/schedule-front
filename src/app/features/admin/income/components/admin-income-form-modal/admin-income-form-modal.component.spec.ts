import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { IncomeEntryView } from '../../../../../core/models/income.models';
import { AdminIncomeFormModalComponent } from './admin-income-form-modal.component';

describe('AdminIncomeFormModalComponent', () => {
  let fixture: ComponentFixture<AdminIncomeFormModalComponent>;
  let component: AdminIncomeFormModalComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

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
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminIncomeFormModalComponent);
    component = fixture.componentInstance;
    component.entry = entry;
    component.defaultDate = '2026-06-10';
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${api}/admin/services`).flush(services);
    httpMock.expectOne(`${api}/admin/staff`).flush(staff);
    await flushMicrotasks();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('registers service income by default, with kind, service and professional', async () => {
    await open(null);
    component.form.patchValue({ serviceId: 's-1', staffProfileId: 'st-1', amount: 25000 });

    const saving = component.submit();
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
    const req = httpMock.expectOne(`${api}/admin/income/i-2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.kind).toBe('MembershipSale');
    expect(req.request.body.amount).toBe(300000);
    expect(req.request.body.serviceId).toBeNull();
    req.flush(sale);
    await saving;
  });
});
