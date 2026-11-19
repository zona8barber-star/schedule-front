import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { BillOptionsView, BillPendingView, BillSummaryView } from '../../../../core/models/bill.models';
import { BillsPageComponent } from './bills-page.component';

describe('BillsPageComponent', () => {
  const api = environment.defaultApiBaseUrl;
  let fixture: ComponentFixture<BillsPageComponent>;
  let component: BillsPageComponent;
  let httpMock: HttpTestingController;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;

  const options: BillOptionsView = {
    services: [],
    products: [],
    staff: [{ id: 'st-1', displayName: 'Alex', isActive: true }],
    paymentMethods: [{ id: 'pm-1', name: 'Efectivo' }],
    ownStaffProfileId: 'st-1',
    canManage: false,
    canDiscount: false,
    canCharge: true,
    canClose: true,
    canApprove: false,
    canVoid: false,
  };

  const summary = (id: string, overrides: Partial<BillSummaryView> = {}): BillSummaryView => ({
    id,
    number: null,
    status: 'Open',
    appointmentId: null,
    customerName: 'Carla',
    isWalkIn: false,
    staffProfileId: 'st-1',
    staffName: 'Alex',
    staffIsActive: true,
    serviceDate: '2026-11-15',
    total: 25000,
    lineCount: 1,
    paymentMethodName: null,
    openedAt: '2026-11-15T15:00:00Z',
    closedAt: null,
    isOverdue: false,
    isSelfApproved: false,
    hasRedemptions: false,
    ...overrides,
  });

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function create(params: Record<string, string> = {}): Promise<void> {
    queryParams = new BehaviorSubject(convertToParamMap(params));
    await TestBed.configureTestingModule({
      imports: [BillsPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams, snapshot: { queryParamMap: queryParams.value } } },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>;
    fixture = TestBed.createComponent(BillsPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/bills/options`).flush(options);
  }

  afterEach(() => httpMock.verify());

  it('lists the bills to close, flags the overdue ones and offers to open the bill of a completed appointment', async () => {
    await create();
    const pending: BillPendingView = {
      openBills: [summary('b-1'), summary('b-2', { customerName: 'Beto', isOverdue: true })],
      appointmentsWithoutBill: [
        { appointmentId: 'a-1', startsAt: '2026-11-14T15:00:00Z', customerName: 'Dani', serviceName: 'Corte', staffProfileId: 'st-1', staffName: 'Alex' },
      ],
      count: 3,
    };
    httpMock.expectOne(`${api}/bills/pending`).flush(pending);
    await settle();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('[data-testid="open-bills"] li').length).toBe(2);
    expect(element.querySelector('[data-bill="b-2"]')?.textContent).toContain('Vencida');
    expect(element.querySelector('[data-bill="b-1"]')?.textContent).not.toContain('Vencida');

    const opening = component.openForAppointment('a-1');
    const request = httpMock.expectOne(`${api}/bills`);
    expect(request.request.body).toMatchObject({ appointmentId: 'a-1' });
    request.flush({ id: 'b-3' });
    await opening;
    expect(navigate).toHaveBeenCalledWith(['/bills', 'b-3']);
  });

  it('opens a walk-in bill with its name, reusing the same key on a retry', async () => {
    await create();
    httpMock.expectOne(`${api}/bills/pending`).flush({ openBills: [], appointmentsWithoutBill: [], count: 0 });
    await settle();

    component.openNewBill();
    component.openForm.patchValue({ walkInName: '  Cliente de paso ' });
    const first = component.openBill();
    const failed = httpMock.expectOne(`${api}/bills`);
    expect(failed.request.body).toMatchObject({ customerName: 'Cliente de paso', customerId: null, staffProfileId: 'st-1' });
    const key = failed.request.body.idempotencyKey;
    failed.flush({ title: 'Error', status: 500 }, { status: 500, statusText: 'Server Error' });
    await first;
    expect(component.openError()).toBeTruthy();

    const retry = component.openBill();
    const stored = httpMock.expectOne(`${api}/bills`);
    expect(stored.request.body.idempotencyKey).toBe(key);
    stored.flush({ id: 'b-9' });
    await retry;
    expect(navigate).toHaveBeenCalledWith(['/bills', 'b-9']);
  });

  it('asks for a customer or a walk-in name before opening', async () => {
    await create();
    httpMock.expectOne(`${api}/bills/pending`).flush({ openBills: [], appointmentsWithoutBill: [], count: 0 });
    component.openNewBill();

    await component.openBill();

    expect(component.openError()).toBe('Elige un cliente o escribe el nombre del cliente ocasional.');
    httpMock.expectNone(`${api}/bills`);
  });

  it('filters any list by service dates, payment method and customer, and «Todas» lists every status', async () => {
    await create({ tab: 'all', from: '2026-11-01', to: '2026-11-10', paymentMethodId: 'pm-1', customerId: 'c-1' });
    const request = httpMock.expectOne((candidate) => candidate.url === `${api}/bills`);
    expect(request.request.params.has('status')).toBe(false);
    expect(request.request.params.get('from')).toBe('2026-11-01');
    expect(request.request.params.get('to')).toBe('2026-11-10');
    expect(request.request.params.get('paymentMethodId')).toBe('pm-1');
    expect(request.request.params.get('customerId')).toBe('c-1');
    request.flush({ items: [summary('b-1', { status: 'Voided', number: 'C-000004' })], page: 1, pageSize: 25, totalCount: 1 });
    await settle();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-bill="b-1"]')!.textContent).toContain('Anulada');
    expect(element.querySelector('[data-testid="bill-filter-customer"]')).not.toBeNull();
    // A professional sees only their own bills: no professional filter.
    expect(element.querySelector('[data-testid="bill-filter-staff"]')).toBeNull();

    element.querySelector<HTMLButtonElement>('[data-testid="bill-filters-clear"]')!.click();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ customerId: null, from: null, paymentMethodId: null }),
    }));
  });

  it('explains a range longer than 30 days instead of asking the API', async () => {
    await create({ tab: 'Approved', from: '2026-09-01', to: '2026-11-10' });
    httpMock.expectNone((candidate) => candidate.url === `${api}/bills`);
    await settle();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('30');
  });

  it('shows the approval tray with the number, the payment method and the self-approved mark', async () => {
    await create({ tab: 'Closed' });
    const request = httpMock.expectOne((candidate) => candidate.url === `${api}/bills`);
    expect(request.request.params.get('status')).toBe('Closed');
    request.flush({
      items: [summary('b-1', { status: 'Closed', number: 'C-000001', paymentMethodName: 'Efectivo', staffIsActive: false, isSelfApproved: true })],
      page: 1,
      pageSize: 25,
      totalCount: 1,
    });
    await settle();

    const row = (fixture.nativeElement as HTMLElement).querySelector('[data-bill="b-1"]')!.textContent!;
    expect(row).toContain('C-000001');
    expect(row).toContain('Efectivo');
    expect(row).toContain('Autoaprobada');
    expect(row).toContain('Profesional inactivo');
    expect(row).toContain('Revisar');
  });

  // SONDA BUG-135: with the API down the page showed only the tabs; now the common error state with «Reintentar».
  it('shows the error state with a retry when the bills cannot be loaded', async () => {
    await create();
    httpMock.expectOne(`${api}/bills/pending`).flush({ title: 'Error' }, { status: 500, statusText: 'Server Error' });
    await settle();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="load-error"]')).not.toBeNull();

    (element.querySelector('[data-testid="load-error-retry"]') as HTMLButtonElement).click();
    httpMock.expectOne(`${api}/bills/pending`).flush({ openBills: [], appointmentsWithoutBill: [], count: 0 });
    await settle();
    expect(element.querySelector('[data-testid="load-error"]')).toBeNull();
    expect(element.textContent).toContain('No hay cuentas por cerrar.');
  });

  // SONDA BUG-157: the search asks for a name from 3 letters, or a full email or phone.
  it('does not search customers with fewer than 3 characters', async () => {
    await create();
    httpMock.expectOne(`${api}/bills/pending`).flush({ openBills: [], appointmentsWithoutBill: [], count: 0 });
    component.openForm.controls.search.setValue('ca');

    await component.searchCustomers();

    httpMock.expectNone((request) => request.url.endsWith('/bills/customers'));
    expect(component.openError()).toContain('al menos 3 letras');
  });

});
