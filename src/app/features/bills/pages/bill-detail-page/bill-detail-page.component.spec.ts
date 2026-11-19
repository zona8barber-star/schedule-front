import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import { BillActionsView, BillLineView, BillOptionsView, BillView } from '../../../../core/models/bill.models';
import { MoneyConfirmationService } from '../../../../core/services/money-confirmation.service';
import { BillDetailPageComponent } from './bill-detail-page.component';

describe('BillDetailPageComponent', () => {
  const api = environment.defaultApiBaseUrl;
  const billId = '6f9619ff-8b86-4d11-b42d-00c04fc964ff';
  let fixture: ComponentFixture<BillDetailPageComponent>;
  let component: BillDetailPageComponent;
  let httpMock: HttpTestingController;
  let confirmMoney: ReturnType<typeof vi.fn>;

  const actions = (overrides: Partial<BillActionsView> = {}): BillActionsView => ({
    canEdit: true,
    canDiscount: false,
    canClose: true,
    canCharge: true,
    canVoid: false,
    canApprove: false,
    canDetachAppointment: false,
    canChangePaymentMethod: false,
    ...overrides,
  });

  const line = (id: string, overrides: Partial<BillLineView> = {}): BillLineView => ({
    id,
    position: 0,
    type: 'Service',
    staffProfileId: 'st-1',
    staffName: 'Alex',
    staffIsActive: true,
    generalServiceId: 'g-cut',
    serviceId: 'r-cut',
    name: 'Corte · Corte clásico',
    quantity: 1,
    unitPrice: 30000,
    amount: 30000,
    businessPercentage: 40,
    isCourtesy: false,
    reason: null,
    productId: null,
    customerMembershipId: null,
    membershipName: null,
    loyaltyRedemptionId: null,
    appliesToLineId: null,
    tipPaymentMode: null,
    catalogPriceNow: 30000,
    availableStock: null,
    ...overrides,
  });

  const bill = (overrides: Partial<BillView> = {}): BillView => ({
    id: billId,
    number: null,
    status: 'Open',
    appointmentId: null,
    appointmentStartsAt: null,
    appointmentStatus: null,
    customerId: null,
    customerName: 'Cliente de paso',
    isWalkIn: true,
    staffProfileId: 'st-1',
    staffName: 'Alex',
    serviceDate: '2026-11-15',
    notes: null,
    openedAt: '2026-11-15T15:00:00Z',
    openedByName: 'Alex',
    closedAt: null,
    closedByName: null,
    paymentMethodId: null,
    paymentMethodName: null,
    subtotal: 30000,
    discountTotal: 0,
    tipTotal: 0,
    directTipTotal: 0,
    total: 30000,
    approvedAt: null,
    approvedByName: null,
    isSelfApproved: false,
    voidedAt: null,
    voidedByName: null,
    voidReason: null,
    isOverdue: false,
    version: 7,
    lines: [line('l-1')],
    warnings: [],
    actions: actions(),
    ...overrides,
  });

  const options: BillOptionsView = {
    services: [{ id: 'g-cut', name: 'Corte', categoryName: 'Barbería', rates: [{ id: 'r-cut', name: 'Corte clásico', price: 30000, loyaltyPoints: 10, isActive: true }] }],
    products: [{ id: 'p-wax', name: 'Cera mate', price: 35000, availableStock: 1 }],
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

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function create(initial: BillView, id = billId): Promise<void> {
    confirmMoney = vi.fn(() => Promise.resolve(true));
    await TestBed.configureTestingModule({
      imports: [BillDetailPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MoneyConfirmationService, useValue: { confirm: confirmMoney } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ billId: id }) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BillDetailPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    if (id === billId) {
      httpMock.expectOne(`${api}/bills/${billId}`).flush(initial);
      httpMock.expectOne(`${api}/bills/options`).flush(options);
    }
    await settle();
  }

  afterEach(() => httpMock.verify());

  it('closes and charges after confirming the total with the payment method', async () => {
    await create(bill({ warnings: ['Stock insuficiente de «Cera mate»: quedan 0 disponibles. Puedes cerrar igual; la existencia quedará en negativo.'] }));
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="bill-warnings"]')?.textContent).toContain('Stock insuficiente');

    await component.closeBill();
    expect(component.errorMessage()).toBe('Elige el método de pago antes de cerrar la cuenta.');
    httpMock.expectNone(`${api}/bills/${billId}/close`);

    component.paymentMethodId.set('pm-1');
    const closing = component.closeBill();
    await settle();
    expect(confirmMoney).toHaveBeenCalledWith(expect.objectContaining({ action: 'Cerrar y cobrar la cuenta', amount: 30000 }));
    const request = httpMock.expectOne(`${api}/bills/${billId}/close`);
    expect(request.request.body).toEqual({ version: 7, paymentMethodId: 'pm-1' });
    request.flush(bill({ status: 'Closed', number: 'C-000001', paymentMethodId: 'pm-1', paymentMethodName: 'Efectivo', actions: actions({ canEdit: false, canClose: false }) }));
    await closing;
    await settle();

    expect(element.querySelector('h1')?.textContent).toContain('Cuenta C-000001');
    expect(element.querySelector('[data-testid="add-line"]')).toBeNull();
  });

  it('closes a bill with nothing to charge without payment method nor confirmation', async () => {
    await create(bill({ subtotal: 0, total: 0, lines: [line('l-1', { type: 'MembershipConsumption', amount: 0, unitPrice: 0, membershipName: 'Oro' })] }));

    const closing = component.closeBill();
    const request = httpMock.expectOne(`${api}/bills/${billId}/close`);
    expect(request.request.body).toEqual({ version: 7, paymentMethodId: null });
    request.flush(bill({ status: 'Closed', number: 'C-000002', total: 0 }));
    await closing;

    expect(confirmMoney).not.toHaveBeenCalled();
  });

  it('adds a tip paid directly, and offers the discount only with the permission', async () => {
    await create(bill());
    const typeOptions = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="line-type"] option')).map(
      (option) => option.textContent!.trim(),
    );
    expect(typeOptions).not.toContain('Descuento');
    // A walk-in bill offers neither memberships nor redemptions (Q4).
    expect(typeOptions).not.toContain('Consumo de membresía');
    expect(typeOptions).not.toContain('Canje de puntos');

    component.lineForm.patchValue({ type: 'Tip', amount: 5000, tipPaymentMode: 'Direct', staffProfileId: 'st-1' });
    const adding = component.addLine();
    await settle();
    // ADR-0021 L6: the typed amount of a tip is confirmed before it is saved.
    expect(confirmMoney).toHaveBeenCalledWith(expect.objectContaining({ action: 'Agregar la propina', amount: 5000 }));
    const request = httpMock.expectOne(`${api}/bills/${billId}/lines`);
    expect(request.request.body).toEqual({ version: 7, type: 'Tip', staffProfileId: 'st-1', amount: 5000, tipPaymentMode: 'Direct' });
    request.flush(bill({ version: 8, directTipTotal: 5000, lines: [line('l-1'), line('l-2', { type: 'Tip', name: 'Propina', unitPrice: 5000, amount: 0, tipPaymentMode: 'Direct' })] }));
    await adding;
    await settle();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-line="l-2"]')?.textContent).toContain('Pagada directo al profesional');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="bill-totals"]')?.textContent).toContain('Propinas pagadas directo');
  });

  it('lets the approver review the postings, skip the points of a line and approve', async () => {
    await create(bill({ status: 'Closed', number: 'C-000003', actions: actions({ canEdit: true, canClose: false, canApprove: true }) }));

    component.openModal('approve');
    httpMock.expectOne(`${api}/bills/${billId}/approval-preview`).flush({
      billId,
      version: 7,
      lines: [{
        lineId: 'l-1', type: 'Service', name: 'Corte · Corte clásico', staffName: 'Alex', staffIsActive: true, gross: 30000, discountShare: 0,
        net: 30000, professionalAmount: 18000, businessAmount: 12000, eligiblePoints: 10, catalogPriceNow: 35000, priceChanged: true,
        effect: 'ServiceIncome',
      }],
      wouldBeSelfApproved: false,
      needsDeliverPermission: false,
      loyaltyEnabled: true,
      warnings: ['El precio de catálogo cambió desde que se agregó alguna línea. Se aprueba lo que se cobró.'],
    });
    await settle();
    const modal = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="approval-lines"]')!.textContent!;
    expect(modal).toContain('Ingreso del servicio y comisión');
    expect(modal).toContain('profesional $ 18.000');
    expect(modal).toContain('se aprueba lo cobrado');

    component.togglePoints('l-1', false);
    const approving = component.approve();
    await settle();
    // ADR-0021 L6: approving posts the money of the bill, so its total is confirmed first.
    expect(confirmMoney).toHaveBeenCalledWith(expect.objectContaining({ action: 'Aprobar la cuenta', amount: 30000 }));
    const request = httpMock.expectOne(`${api}/bills/${billId}/approve`);
    expect(request.request.body).toMatchObject({ version: 7, noPointsLineIds: ['l-1'], notes: null });
    request.flush(bill({ status: 'Approved', number: 'C-000003', actions: actions({ canEdit: false, canClose: false }) }));
    await approving;

    expect(component.modal()).toBeNull();
    expect(component.bill()?.status).toBe('Approved');
  });

  it('L6: does not add a discount nor approve when the amount confirmation is declined', async () => {
    await create(bill({ actions: actions({ canDiscount: true }) }));
    confirmMoney.mockResolvedValue(false);

    component.lineForm.patchValue({ type: 'Discount', amount: 2000, reason: 'Cliente frecuente' });
    await component.addLine();
    expect(confirmMoney).toHaveBeenCalledWith(expect.objectContaining({ action: 'Agregar el descuento', amount: 2000, detail: 'Cliente frecuente' }));
    httpMock.expectNone(`${api}/bills/${billId}/lines`);

    component.bill.set(bill({ status: 'Closed', actions: actions({ canApprove: true }) }));
    await component.approve();
    httpMock.expectNone(`${api}/bills/${billId}/approve`);
  });

  it('L1: without the permission, services and tips only offer the own professional; products offer everyone', async () => {
    options.staff = [
      { id: 'st-1', displayName: 'Alex', isActive: true },
      { id: 'st-2', displayName: 'Beto', isActive: true },
    ];
    try {
      await create(bill({ staffProfileId: 'st-2' }));
      const element = fixture.nativeElement as HTMLElement;
      const staffOptions = () =>
        Array.from(element.querySelectorAll('[data-testid="line-staff"] option')).map((option) => option.textContent!.trim());

      expect(component.lineForm.controls.staffProfileId.value).toBe('st-1');
      expect(staffOptions()).toEqual(['Sin profesional', 'Alex']);
      expect(element.querySelector('[data-testid="own-staff-only"]')?.textContent).toContain('a tu nombre');

      component.lineForm.controls.type.setValue('Product');
      component.onTypeChange();
      await settle();
      expect(staffOptions()).toEqual(['Sin profesional', 'Alex', 'Beto']);

      component.lineForm.patchValue({ staffProfileId: 'st-2' });
      component.lineForm.controls.type.setValue('Tip');
      component.onTypeChange();
      await settle();
      expect(component.lineForm.controls.staffProfileId.value).toBe('st-1');
    } finally {
      options.staff = [{ id: 'st-1', displayName: 'Alex', isActive: true }];
    }
  });

  it('L1: with the permission, every active professional is offered', async () => {
    options.staff = [
      { id: 'st-1', displayName: 'Alex', isActive: true },
      { id: 'st-2', displayName: 'Beto', isActive: true },
    ];
    options.canAssignOtherStaff = true;
    try {
      await create(bill({ staffProfileId: 'st-2' }));
      const element = fixture.nativeElement as HTMLElement;

      expect(component.lineForm.controls.staffProfileId.value).toBe('st-2');
      expect(Array.from(element.querySelectorAll('[data-testid="line-staff"] option')).map((option) => option.textContent!.trim())).toEqual([
        'Sin profesional',
        'Alex',
        'Beto',
      ]);
      expect(element.querySelector('[data-testid="own-staff-only"]')).toBeNull();
    } finally {
      options.staff = [{ id: 'st-1', displayName: 'Alex', isActive: true }];
      options.canAssignOtherStaff = undefined;
    }
  });

  it('voids with a reason', async () => {
    await create(bill({ actions: actions({ canVoid: true }) }));
    component.openModal('void');
    await component.submitReason();
    httpMock.expectNone(`${api}/bills/${billId}/void`);

    component.reasonForm.setValue({ reason: '  Cliente se fue sin atender ' });
    const voiding = component.submitReason();
    const request = httpMock.expectOne(`${api}/bills/${billId}/void`);
    expect(request.request.body).toEqual({ version: 7, reason: 'Cliente se fue sin atender' });
    request.flush(bill({ status: 'Voided', voidReason: 'Cliente se fue sin atender', actions: actions({ canEdit: false, canClose: false }) }));
    await voiding;

    expect(component.bill()?.status).toBe('Voided');
  });

  it('unapproves an approved bill with a reason, reusing the key on a retry, and shows why it is being corrected', async () => {
    await create(bill({ status: 'Approved', number: 'C-000004', actions: actions({ canEdit: false, canClose: false, canUnapprove: true }) }));
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="unapprove-bill"]')).not.toBeNull();

    component.openModal('unapprove');
    component.reasonForm.setValue({ reason: 'Se cobró de más' });
    const first = component.submitReason();
    const failed = httpMock.expectOne(`${api}/bills/${billId}/unapprove`);
    expect(failed.request.body).toMatchObject({ version: 7, reason: 'Se cobró de más' });
    const key = failed.request.body.idempotencyKey;
    failed.flush({ title: 'Error', status: 500 }, { status: 500, statusText: 'Server Error' });
    await first;

    const retry = component.submitReason();
    const stored = httpMock.expectOne(`${api}/bills/${billId}/unapprove`);
    expect(stored.request.body.idempotencyKey).toBe(key);
    stored.flush(bill({
      status: 'Unapproved', number: 'C-000004', approvalCount: 1, lastUnapprovedAt: '2026-11-16T15:00:00Z', lastUnapprovedByName: 'Ana',
      lastUnapprovalReason: 'Se cobró de más', actions: actions({ canEdit: true, canClose: false, canApprove: true, canVoid: true }),
    }));
    await retry;
    await settle();

    expect(component.modal()).toBeNull();
    expect(element.querySelector('[data-testid="bill-status"]')?.textContent).toContain('En corrección');
    expect(element.querySelector('[data-testid="unapproval-reason"]')?.textContent).toContain('Se cobró de más');
    expect(element.querySelector('[data-testid="approve-bill"]')).not.toBeNull();
  });

  it('shows the not-found state for an id that is not a GUID, without calling the API', async () => {
    await create(bill(), 'no-existe');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No encontramos esta cuenta');
    httpMock.expectNone(() => true);
  });

  // ADR-0021 L11 (SONDA BUG-172): correcting the payment method asks for the reason and sends it.
  it('corrects the payment method of a closed bill only with a reason', async () => {
    await create(
      bill({ status: 'Closed', number: 'C-000010', paymentMethodId: 'pm-1', paymentMethodName: 'Efectivo', actions: actions({ canEdit: false, canChangePaymentMethod: true }) }),
    );
    component.paymentMethodId.set('pm-2');
    component.changePaymentMethod();
    expect(component.modal()).toBe('paymentMethod');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Corregir el método de pago');

    await component.submitReason();
    httpMock.expectNone(`${api}/bills/${billId}/payment-method`);

    component.reasonForm.setValue({ reason: 'Pagó con tarjeta' });
    const saving = component.submitReason();
    const request = httpMock.expectOne(`${api}/bills/${billId}/payment-method`);
    expect(request.request.body).toEqual({ version: 7, paymentMethodId: 'pm-2', reason: 'Pagó con tarjeta' });
    request.flush(bill({ status: 'Closed', number: 'C-000010', paymentMethodId: 'pm-2', paymentMethodName: 'Tarjeta' }));
    await saving;

    expect(component.modal()).toBeNull();
    expect(component.bill()?.paymentMethodName).toBe('Tarjeta');
  });
});

