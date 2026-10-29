import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { CustomerMembershipDetailView, MembershipGiftView } from '../../../../../core/models/membership.models';
import { bogotaToday } from '../../membership-labels';
import { AdminMembershipGiftDeliveryModalComponent } from './admin-membership-gift-delivery-modal.component';

describe('AdminMembershipGiftDeliveryModalComponent', () => {
  let fixture: ComponentFixture<AdminMembershipGiftDeliveryModalComponent>;
  let component: AdminMembershipGiftDeliveryModalComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;
  const today = bogotaToday();

  const membership = { id: 'm-1', planName: 'Oro', customerName: 'Carlos Pérez', soldOn: '2026-10-01' } as CustomerMembershipDetailView;
  const gift = { id: 'g-1', kind: 'Physical', quantity: 2, description: 'Gorra', status: 'PendingDelivery' } as MembershipGiftView;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMembershipGiftDeliveryModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMembershipGiftDeliveryModalComponent);
    component = fixture.componentInstance;
    component.membership = membership;
    component.gift = gift;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('delivers the whole gift, dated today by default', () => {
    expect(component.deliveredOn()).toBe(today);
    expect(fixture.nativeElement.textContent).toContain('Se entrega completo: 2 × Gorra');
    expect(fixture.nativeElement.querySelector('input[type=number]')).toBeNull(); // no quantity to choose
  });

  it('blocks future dates and dates before the sale before calling the server', async () => {
    component.deliveredOn.set('2999-01-01');
    await component.submit();
    expect(component.problems()).toEqual(['La fecha de entrega no puede ser futura.']);

    component.deliveredOn.set('2026-09-30');
    await component.submit();
    expect(component.problems()[0]).toContain('anterior a la venta');

    httpMock.expectNone(`${api}/admin/memberships/m-1/gifts/g-1/deliveries`);
  });

  it('sends one idempotency key that a retry reuses', async () => {
    const first = component.submit();
    const req = httpMock.expectOne(`${api}/admin/memberships/m-1/gifts/g-1/deliveries`);
    expect(req.request.body).toEqual({ deliveredOn: today, idempotencyKey: component.idempotencyKey });
    req.flush({ title: 'Network' }, { status: 503, statusText: 'Unavailable' });
    await first;

    const retry = component.submit();
    const retried = httpMock.expectOne(`${api}/admin/memberships/m-1/gifts/g-1/deliveries`);
    expect(retried.request.body.idempotencyKey).toBe(component.idempotencyKey);
    retried.flush(membership);
    await retry;
  });
});
