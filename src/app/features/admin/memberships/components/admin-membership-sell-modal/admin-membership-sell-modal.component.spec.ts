import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { MembershipPlanView } from '../../../../../core/models/membership-plan.models';
import { AdminMembershipSellModalComponent } from './admin-membership-sell-modal.component';

describe('AdminMembershipSellModalComponent', () => {
  let fixture: ComponentFixture<AdminMembershipSellModalComponent>;
  let component: AdminMembershipSellModalComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const plan = (overrides: Partial<MembershipPlanView>): MembershipPlanView => ({
    id: 'p-1',
    name: 'Oro',
    description: null,
    price: 250000,
    mode: 'Pool',
    poolQuantity: 10,
    defaultDurationDays: 30,
    terms: 'T',
    specificConditions: null,
    isActive: true,
    services: [{ serviceId: 's-1', serviceName: 'Corte', serviceBasePrice: 25000, serviceIsActive: true, quantity: null }],
    giftRules: [
      { id: 'g-1', kind: 'Physical', serviceId: null, serviceName: null, description: 'Gorra', quantity: 1, condition: 'FirstPurchaseOfPlan' },
    ],
    createdAt: '',
    updatedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMembershipSellModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMembershipSellModalComponent);
    component = fixture.componentInstance;
    component.customerId = 'c-1';
    component.customerName = 'Carlos Pérez';
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${api}/admin/membership-plans`).flush([plan({}), plan({ id: 'p-2', name: 'Vieja', isActive: false })]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('only offers active plans and shows what the plan includes', () => {
    expect(component.plans().map((option) => option.id)).toEqual(['p-1']);

    component.onPlanChange('p-1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Bolsa común de 10 servicios');
    expect(fixture.nativeElement.textContent).toContain('Gorra');
    expect(fixture.nativeElement.textContent).toContain('primera compra');
  });

  it('derives an inclusive end date from the plan until the admin adjusts it', () => {
    component.onStartsOnChange('2026-11-01');
    component.onPlanChange('p-1');
    expect(component.endsOn()).toBe('2026-11-30');

    component.onStartsOnChange('2026-12-01');
    expect(component.endsOn()).toBe('2026-12-30');

    component.onEndsOnChange('2027-01-15');
    component.onStartsOnChange('2026-12-05');
    expect(component.endsOn()).toBe('2027-01-15'); // a manual end date is kept

    component.resetEndsOn();
    expect(component.endsOn()).toBe('2027-01-03');
  });

  it('sells with the chosen dates and activation', async () => {
    component.onPlanChange('p-1');
    component.onStartsOnChange(component.today);
    component.activateNow.set(true);

    const selling = component.submit();
    const req = httpMock.expectOne(`${api}/admin/customers/c-1/memberships`);
    expect(req.request.body).toEqual({
      planId: 'p-1',
      startsOn: component.today,
      endsOn: component.endsOn(),
      soldOn: component.today,
      activateNow: true,
      confirmExpiredActivation: false,
      activationReason: null,
    });
    req.flush({ id: 'm-1' });
    await selling;
  });

  it('asks for confirmation and a reason before activating an already expired membership', async () => {
    component.onPlanChange('p-1');
    component.onStartsOnChange('2020-01-01');
    component.activateNow.set(true);
    fixture.detectChanges();

    expect(component.isExpiredActivation()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('operación excepcional');

    await component.submit();
    httpMock.expectNone(`${api}/admin/customers/c-1/memberships`);

    component.confirmExpired.set(true);
    component.activationReason.set('Venta registrada tarde');
    const selling = component.submit();
    const req = httpMock.expectOne(`${api}/admin/customers/c-1/memberships`);
    expect(req.request.body.confirmExpiredActivation).toBe(true);
    expect(req.request.body.activationReason).toBe('Venta registrada tarde');
    req.flush({ id: 'm-1' });
    await selling;
  });
});
