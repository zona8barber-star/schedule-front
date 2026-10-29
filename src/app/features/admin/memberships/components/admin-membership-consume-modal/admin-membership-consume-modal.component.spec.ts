import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { CustomerMembershipDetailView } from '../../../../../core/models/membership.models';
import { StaffListItem } from '../../../../../core/models/staff.models';
import { bogotaToday } from '../../membership-labels';
import { AdminMembershipConsumeModalComponent } from './admin-membership-consume-modal.component';

describe('AdminMembershipConsumeModalComponent', () => {
  let fixture: ComponentFixture<AdminMembershipConsumeModalComponent>;
  let component: AdminMembershipConsumeModalComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;
  const today = bogotaToday();

  const membership = {
    id: 'm-1',
    planName: 'Oro',
    customerName: 'Carlos Pérez',
    startsOn: '2026-01-01',
    endsOn: '2099-12-31',
    allowances: [
      {
        id: 'a-1',
        origin: 'Purchased',
        giftId: null,
        grantedQuantity: 10,
        consumedQuantity: 3,
        availableQuantity: 7,
        services: [
          { serviceId: 's-beard', serviceName: 'Barba' },
          { serviceId: 's-cut', serviceName: 'Corte' },
        ],
      },
      {
        id: 'a-2',
        origin: 'Gift',
        giftId: 'g-1',
        grantedQuantity: 2,
        consumedQuantity: 0,
        availableQuantity: 2,
        services: [{ serviceId: 's-beard', serviceName: 'Barba' }],
      },
    ],
  } as unknown as CustomerMembershipDetailView;

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMembershipConsumeModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMembershipConsumeModalComponent);
    component = fixture.componentInstance;
    component.membership = membership;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${api}/admin/staff`).flush([
      { staffProfileId: 'st-1', displayName: 'Alex', isActive: true },
      { staffProfileId: 'st-2', displayName: 'Inactivo', isActive: false },
    ] as StaffListItem[]);
    await flushMicrotasks();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows gifted and purchased balances per service and only active professionals', () => {
    expect(component.balances()).toEqual([
      { serviceId: 's-beard', serviceName: 'Barba', gifted: 2, purchased: 7 },
      { serviceId: 's-cut', serviceName: 'Corte', gifted: 0, purchased: 7 },
    ]);
    expect(component.staff().map((member) => member.staffProfileId)).toEqual(['st-1']);
    expect(component.serviceDate()).toBe(today);
  });

  it('previews that gifted units go first, even when one consumption uses both', () => {
    component.serviceId.set('s-beard');
    component.quantity.set(3);
    fixture.detectChanges();

    expect(component.split()).toEqual({ gifted: 2, purchased: 1 });
    expect(fixture.nativeElement.textContent).toContain('2 regalado(s)');
    expect(fixture.nativeElement.textContent).toContain('1 pagado(s)');
  });

  it('blocks decimals, zero, more than the balance and dates outside the validity before calling the server', async () => {
    component.serviceId.set('s-cut');

    for (const quantity of [1.5, 0, -2, 8]) {
      component.quantity.set(quantity);
      await component.submit();
    }
    component.quantity.set(1);
    component.serviceDate.set('2025-12-31');
    await component.submit();
    component.serviceDate.set('2999-01-01');
    await component.submit();

    httpMock.expectNone(`${api}/admin/memberships/m-1/consumptions`);
    expect(component.problems()).toContain('La fecha del servicio no puede ser futura.');
  });

  it('sends the consumption with one idempotency key that a retry reuses', async () => {
    component.serviceId.set('s-beard');
    component.quantity.set(2);
    component.staffProfileId.set('st-1');

    const first = component.submit();
    const req = httpMock.expectOne(`${api}/admin/memberships/m-1/consumptions`);
    expect(req.request.body).toEqual({
      serviceId: 's-beard',
      quantity: 2,
      serviceDate: today,
      staffProfileId: 'st-1',
      idempotencyKey: component.idempotencyKey,
    });
    req.flush({ title: 'Network' }, { status: 503, statusText: 'Unavailable' });
    await first;

    const retry = component.submit();
    const retried = httpMock.expectOne(`${api}/admin/memberships/m-1/consumptions`);
    expect(retried.request.body.idempotencyKey).toBe(component.idempotencyKey);
    retried.flush(membership);
    await retry;
  });
});
