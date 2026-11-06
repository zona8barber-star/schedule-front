import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { PERMISSION_CODES, PermissionCode } from '../../../../../core/models/auth.models';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  ServiceRecordCustomerOption,
  ServiceRecordOptionsView,
  ServiceRecordRelatedView,
  ServiceRecordView,
} from '../../../../../core/models/service-record.models';
import { AdminServiceRecordReviewModalComponent } from './admin-service-record-review-modal.component';

describe('AdminServiceRecordReviewModalComponent', () => {
  let fixture: ComponentFixture<AdminServiceRecordReviewModalComponent>;
  let component: AdminServiceRecordReviewModalComponent;
  let httpMock: HttpTestingController;
  const base = `${environment.defaultApiBaseUrl}/admin/service-records`;

  const record: ServiceRecordView = {
    id: 'r-1',
    status: 'Pending',
    appointmentId: null,
    appointmentStartsAt: null,
    staffProfileId: 'st-alex',
    staffName: 'Alex',
    serviceId: 's-cut',
    serviceName: 'Corte',
    performedOn: '2026-11-02',
    customerId: null,
    customerName: null,
    notes: null,
    registeredAt: '2026-11-02T15:00:00Z',
    registeredByName: 'Alex Barbero',
    approval: null,
    rejectionReason: null,
    rejectedAt: null,
    rejectedByName: null,
    version: 41,
  };

  const options = (loyaltyProgramEnabled = true): ServiceRecordOptionsView => ({
    services: [
      { id: 's-cut', name: 'Corte', basePrice: 25000, loyaltyPoints: 10, isActive: true },
      { id: 's-beard', name: 'Barba', basePrice: 15000, loyaltyPoints: 0, isActive: true },
    ],
    staff: [
      { id: 'st-alex', displayName: 'Alex', isActive: true },
      { id: 'st-beto', displayName: 'Beto', isActive: true },
    ],
    loyaltyProgramEnabled,
  });

  const carla: ServiceRecordCustomerOption = {
    id: 'c-1',
    fullName: 'Carla',
    phoneHint: '•••4567',
    memberships: [{ id: 'm-1', planName: 'Oro', status: 'Active', startsOn: '2026-10-01', endsOn: '2026-12-30' }],
  };

  let related: ServiceRecordRelatedView = { manualIncomes: [], otherRecords: [], membershipConsumptions: [], appointmentStatus: null };

  beforeEach(() => {
    related = { manualIncomes: [], otherRecords: [], membershipConsumptions: [], appointmentStatus: null };
  });

  async function open(loyaltyProgramEnabled = true, permissions: PermissionCode[] = []): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminServiceRecordReviewModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { hasPermission: (code: PermissionCode) => permissions.includes(code) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminServiceRecordReviewModalComponent);
    component = fixture.componentInstance;
    component.record = record;
    component.options = options(loyaltyProgramEnabled);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${base}/r-1/related`).flush(related);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('offers the reward type only with the deliver permission', async () => {
    await open(true, []);
    expect(component.selectableOperations).not.toContain('LoyaltyReward');
    expect(fixture.nativeElement.textContent).toContain('requiere permiso para entregar recompensas');
  });

  it('after a failed confirmation, choosing a reward with a single redemption confirms without selecting it again', async () => {
    await open(true, [PERMISSION_CODES.loyaltyRedemptionsDeliver]);
    component.selectCustomer(carla);

    // 1. A failed confirmation: a paid service without a charged amount. The problems become visible.
    component.form.controls.chargedAmount.setValue(null);
    await component.approve();
    fixture.detectChanges();
    expect(component.submitted()).toBe(true);
    expect(component.problems().length).toBeGreaterThan(0);

    // 2. Choosing the reward loads the customer's redemptions; 3. the only one is selected automatically.
    component.form.controls.operationType.setValue('LoyaltyReward');
    fixture.detectChanges();
    httpMock.expectOne((request) => request.url === `${base}/redemption-options`).flush([
      {
        id: 'd-1', rewardName: 'Corte gratis', serviceId: 's-cut', serviceName: 'Corte', pointsCost: 80,
        approvedAt: '2026-11-04T15:00:00Z', deliverBy: '2026-12-03', isPastDeadline: false,
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.form.controls.loyaltyRedemptionId.value).toBe('d-1');
    expect(component.problems()).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Elige el canje aprobado');

    // 4. Confirming works without choosing the redemption again.
    const approving = component.approve();
    const req = httpMock.expectOne(`${base}/r-1/approve`);
    expect(req.request.body).toEqual(expect.objectContaining({ operationType: 'LoyaltyReward', loyaltyRedemptionId: 'd-1' }));
    req.flush({ ...record, status: 'Approved' });
    await approving;
  });

  it('describes what accruing points does now that the wallet exists', async () => {
    await open(true, []);
    component.selectCustomer(carla);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Al confirmar se acreditan en la billetera del cliente');
    expect(text).not.toContain('cuando exista la billetera');
  });

  it('confirms a reward delivering the approved redemption of the customer for that service', async () => {
    await open(true, [PERMISSION_CODES.loyaltyRedemptionsDeliver]);
    component.selectCustomer(carla);
    component.form.controls.operationType.setValue('LoyaltyReward');
    const options = httpMock.expectOne((request) => request.url === `${base}/redemption-options`);
    expect(options.request.params.get('customerId')).toBe('c-1');
    expect(options.request.params.get('serviceId')).toBe('s-cut');
    options.flush([
      {
        id: 'd-1', rewardName: 'Corte gratis', serviceId: 's-cut', serviceName: 'Corte', pointsCost: 80,
        approvedAt: '2026-11-04T15:00:00Z', deliverBy: '2026-12-03', isPastDeadline: false,
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.form.controls.loyaltyRedemptionId.value).toBe('d-1');
    expect(component.problems()).toEqual([]);

    const approving = component.approve();
    const req = httpMock.expectOne(`${base}/r-1/approve`);
    expect(req.request.body).toEqual(
      expect.objectContaining({ operationType: 'LoyaltyReward', customerId: 'c-1', chargedAmount: null, loyaltyRedemptionId: 'd-1', accruesLoyaltyPoints: false }),
    );
    req.flush({ ...record, status: 'Approved' });
    await approving;
  });

  it('confirms a paid service with the corrected professional and the charged amount (prefilled with the base price)', async () => {
    await open();
    expect(component.form.controls.chargedAmount.value).toBe(25000);
    component.form.patchValue({ staffProfileId: 'st-beto', chargedAmount: 22000 });
    const emitted: ServiceRecordView[] = [];
    component.reviewed.subscribe((value) => emitted.push(value));

    const approving = component.approve();
    const req = httpMock.expectOne(`${base}/r-1/approve`);
    expect(req.request.body).toEqual({
      version: 41,
      operationType: 'Paid',
      serviceId: 's-cut',
      staffProfileId: 'st-beto',
      customerId: null,
      performedOn: '2026-11-02',
      chargedAmount: 22000,
      customerMembershipId: null,
      accruesLoyaltyPoints: false,
      notes: null,
    });
    req.flush({ ...record, status: 'Approved' });
    await approving;
    expect(emitted.length).toBe(1);
  });

  it('only lets an eligible paid service accrue points', async () => {
    await open();
    expect(component.pointsBlocker()).toBe('Identifica al cliente para que pueda acumular puntos.');
    expect(component.form.controls.accruesLoyaltyPoints.disabled).toBe(true);

    component.selectCustomer(carla);
    fixture.detectChanges();
    expect(component.pointsBlocker()).toBeNull();
    expect(component.form.controls.accruesLoyaltyPoints.enabled).toBe(true);
    component.form.controls.accruesLoyaltyPoints.setValue(true);

    component.form.controls.serviceId.setValue('s-beard'); // 0 points
    expect(component.pointsBlocker()).toBe('El servicio no tiene puntos configurados.');
    expect(component.form.controls.accruesLoyaltyPoints.value).toBe(false);

    component.form.controls.serviceId.setValue('s-cut');
    component.form.controls.operationType.setValue('Courtesy');
    expect(component.pointsBlocker()).toBe('Solo un servicio pagado acumula puntos.');
  });

  it('does not offer points when the program is disabled', async () => {
    await open(false);
    component.selectCustomer(carla);

    expect(component.pointsBlocker()).toBe('El programa de fidelización está deshabilitado.');
  });

  it('confirms a membership consumption without amount, requiring customer and membership', async () => {
    await open();
    component.form.controls.operationType.setValue('MembershipConsumption');

    await component.approve();
    expect(component.problems()).toContain('Elige el cliente dueño de la membresía.');
    httpMock.expectNone(`${base}/r-1/approve`);

    component.selectCustomer(carla); // single active membership: preselected
    const approving = component.approve();
    const req = httpMock.expectOne(`${base}/r-1/approve`);
    expect(req.request.body.operationType).toBe('MembershipConsumption');
    expect(req.request.body.customerId).toBe('c-1');
    expect(req.request.body.customerMembershipId).toBe('m-1');
    expect(req.request.body.chargedAmount).toBeNull();
    expect(req.request.body.accruesLoyaltyPoints).toBe(false);
    req.flush({ ...record, status: 'Approved' });
    await approving;
  });

  it('rejects with a reason', async () => {
    await open();
    component.rejecting.set(true);

    await component.reject();
    expect(component.errorMessage()).toContain('motivo');
    httpMock.expectNone(`${base}/r-1/reject`);

    component.form.controls.rejectionReason.setValue('Servicio duplicado');
    const rejecting = component.reject();
    const req = httpMock.expectOne(`${base}/r-1/reject`);
    expect(req.request.body).toEqual({ version: 41, reason: 'Servicio duplicado' });
    req.flush({ ...record, status: 'Rejected' });
    await rejecting;
  });

  it('explains a conflict and offers to reload the inbox', async () => {
    await open();
    let stale = 0;
    component.staleDetected.subscribe(() => stale++);

    const approving = component.approve();
    httpMock.expectOne(`${base}/r-1/approve`).flush(
      { detail: 'Este servicio ya fue revisado por otra persona. Recarga la bandeja.' },
      { status: 409, statusText: 'Conflict' },
    );
    await approving;
    fixture.detectChanges();

    expect(component.hasConflict()).toBe(true);
    const reload = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (button) => button.textContent?.trim() === 'Recargar bandeja',
    );
    reload!.click();
    expect(stale).toBe(1);
  });
  it('warns about possible duplicates without blocking the confirmation', async () => {
    related = {
      manualIncomes: [{ id: 'i-1', amount: 25000, occurredOn: '2026-11-02', createdAt: '2026-11-02T16:00:00Z' }],
      otherRecords: [],
      membershipConsumptions: [
        { id: 'mc-1', customerMembershipId: 'm-1', serviceName: 'Corte', serviceDate: '2026-11-02', isFromServiceRecord: false },
      ],
      appointmentStatus: 'Cancelled',
    };
    await open();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Revisa posibles duplicados');
    expect(text).toContain('Ingreso manual del mismo profesional, servicio y día');
    expect(text).toContain('registrado en la membresía');
    expect(text).toContain('ahora figura como cancelada');

    const approving = component.approve();
    httpMock.expectOne(`${base}/r-1/approve`).flush({ ...record, status: 'Approved' });
    await approving;
  });

  it('creates a new customer through the review routes and selects it, without memberships or account', async () => {
    await open();
    component.openCreateCustomer();
    fixture.detectChanges();
    await fixture.whenStable();

    const modal = fixture.nativeElement.querySelector('app-admin-customer-form-modal');
    expect(modal).toBeTruthy();
    const source = component.customerSource;
    source.create({ fullName: 'Nuevo', phone: '3007654321', email: 'nuevo@example.com' }).subscribe();
    const create = httpMock.expectOne(`${base}/customers`);
    expect(create.request.method).toBe('POST');
    create.flush({ id: 'c-new', fullName: 'Nuevo', phoneHint: '•••4321', memberships: [] });

    // Duplicates arrive as hints; a matching account gets no real id.
    let shown: unknown[] = [];
    source.findDuplicates('nuevo@example.com', '3007654321').subscribe((found) => (shown = found));
    const duplicates = httpMock.expectOne((request) => request.url === `${base}/customer-duplicates`);
    expect(duplicates.request.params.get('email')).toBe('nuevo@example.com');
    duplicates.flush([
      { kind: 'customer', customerId: 'c-9', fullName: 'Nuevo', emailHint: 'n•••@example.com', phoneHint: '•••4321', matchedOn: ['phone'] },
      { kind: 'account', customerId: null, fullName: 'Nuevo', emailHint: 'n•••@example.com', phoneHint: null, matchedOn: ['email'] },
    ]);
    expect(shown).toEqual([
      { kind: 'customer', id: 'c-9', fullName: 'Nuevo', email: 'n•••@example.com', phone: '•••4321', matchedOn: ['phone'], isLinked: false },
      { kind: 'account', id: 'account-1', fullName: 'Nuevo', email: 'n•••@example.com', phone: null, matchedOn: ['email'], isLinked: false },
    ]);

    component.onCustomerCreated({ id: 'c-new', fullName: 'Nuevo', phoneHint: '•••4321' });
    fixture.detectChanges();
    expect(component.creatingCustomer()).toBe(false);
    expect(component.customer()).toEqual({ id: 'c-new', fullName: 'Nuevo', phoneHint: '•••4321', memberships: [] });
  });
});
