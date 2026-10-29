import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { CustomerDetailView, CustomerDuplicateCandidate } from '../../../../../core/models/customer.models';
import { AdminCustomerFormModalComponent } from './admin-customer-form-modal.component';

describe('AdminCustomerFormModalComponent', () => {
  let fixture: ComponentFixture<AdminCustomerFormModalComponent>;
  let component: AdminCustomerFormModalComponent;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/customers`;

  const created: CustomerDetailView = {
    id: 'c-1',
    fullName: 'Carlos Pérez',
    phone: '3001234567',
    email: 'carlos@example.com',
    linkedAccount: null,
    mergedIntoCustomerId: null,
    mergedIntoCustomerName: null,
    mergedAt: null,
    createdAt: '2026-10-28T10:00:00Z',
    updatedAt: null,
    events: [],
  };

  const duplicate: CustomerDuplicateCandidate = {
    kind: 'customer',
    id: 'c-9',
    fullName: 'Carlos P.',
    email: 'carlos@example.com',
    phone: '3001234567',
    matchedOn: ['email'],
    isLinked: false,
  };

  /** submit() awaits the duplicate check and then the save; each hop needs the microtask queue drained. */
  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCustomerFormModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCustomerFormModalComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function fillForm(): void {
    component.form.setValue({ fullName: 'Carlos Pérez', phone: '3001234567', email: 'carlos@example.com' });
  }

  it('does not call the API when required fields are missing', async () => {
    await component.submit();

    expect(component.form.invalid).toBe(true);
    httpMock.expectNone(() => true);
  });

  it('creates the customer directly when no duplicates are found', async () => {
    const emitted: CustomerDetailView[] = [];
    component.saved.subscribe((value) => emitted.push(value));
    fillForm();

    const submitting = component.submit();
    httpMock.expectOne((request) => request.url === `${base}/duplicates`).flush([]);
    await flushMicrotasks();
    const createReq = httpMock.expectOne(base);
    expect(createReq.request.method).toBe('POST');
    createReq.flush(created);
    await submitting;

    expect(emitted).toEqual([created]);
  });

  it('warns about duplicates first and saves on the second submit', async () => {
    const emitted: CustomerDetailView[] = [];
    component.saved.subscribe((value) => emitted.push(value));
    fillForm();

    const firstSubmit = component.submit();
    httpMock.expectOne((request) => request.url === `${base}/duplicates`).flush([duplicate]);
    await firstSubmit;
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Carlos P.');
    expect(fixture.nativeElement.textContent).toContain('Guardar de todas formas');

    const secondSubmit = component.submit();
    httpMock.expectOne(base).flush(created);
    await secondSubmit;

    expect(emitted).toEqual([created]);
  });

  it('checks duplicates again when the contact data changes after the warning', async () => {
    fillForm();
    const firstSubmit = component.submit();
    httpMock.expectOne((request) => request.url === `${base}/duplicates`).flush([duplicate]);
    await firstSubmit;

    component.form.controls.email.setValue('otro@example.com');
    expect(component.duplicates()).toEqual([]);

    const secondSubmit = component.submit();
    httpMock.expectOne((request) => request.url === `${base}/duplicates`).flush([]);
    await flushMicrotasks();
    httpMock.expectOne(base).flush(created);
    await secondSubmit;
  });
});
