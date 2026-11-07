import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { MyLoyaltyCatalogView, MyLoyaltyRedemptionView } from '../../../../../core/models/loyalty-redemption.models';
import { MyLoyaltyView } from '../../../../../core/models/loyalty-wallet.models';
import { MyLoyaltyPageComponent } from './my-loyalty-page.component';

describe('MyLoyaltyPageComponent', () => {
  let fixture: ComponentFixture<MyLoyaltyPageComponent>;
  let component: MyLoyaltyPageComponent;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  const points: MyLoyaltyView = {
    hasProfile: true,
    programEnabled: true,
    availablePoints: 50,
    debtPoints: 0,
    expiringSoonPoints: 20,
    nextExpiresOn: '2026-11-12',
    reservedPoints: 30,
    lots: [
      { usablePoints: 20, accruedOn: '2026-11-03', expiresOn: '2026-11-12', sourceLabel: 'Membresía: Oro' },
      { usablePoints: 30, accruedOn: '2026-11-03', expiresOn: '2027-11-02', sourceLabel: 'Servicio: Corte' },
    ],
    movements: [
      { type: 'Accrual', points: 30, performedAt: '2026-11-03T15:00:00Z' },
      { type: 'MembershipAnnulmentWithdrawal', points: 20, performedAt: '2026-11-03T16:00:00Z' },
      { type: 'RedemptionHold', points: 30, performedAt: '2026-11-04T16:00:00Z' },
      { type: 'RedemptionConsumed', points: 25, performedAt: '2026-11-04T17:00:00Z' },
    ],
  };

  const catalog: MyLoyaltyCatalogView = {
    hasProfile: true,
    programEnabled: true,
    availablePoints: 50,
    rewards: [
      { id: 'r-1', name: 'Gorra', description: 'De la barbería', kind: 'Other', serviceName: null, pointsCost: 40, canAfford: true },
      { id: 'r-2', name: 'Corte gratis', description: null, kind: 'Service', serviceName: 'Corte', pointsCost: 80, canAfford: false },
    ],
  };

  const pending: MyLoyaltyRedemptionView = {
    id: 'd-1',
    rewardName: 'Llavero',
    rewardKind: 'Other',
    serviceName: null,
    pointsCost: 30,
    status: 'Requested',
    requestedAt: '2026-11-04T15:00:00Z',
    approveBy: '2026-12-03',
    approvedAt: null,
    deliverBy: null,
    deliveredAt: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledAt: null,
    cancelledByCustomer: false,
    expiredAt: null,
    isPastDeadline: false,
    canCancel: true,
  };

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function flushAll(view: MyLoyaltyView, rewards: MyLoyaltyCatalogView, redemptions: MyLoyaltyRedemptionView[]): void {
    httpMock.expectOne(`${api}/customer/loyalty`).flush(view);
    httpMock.expectOne(`${api}/customer/loyalty/rewards`).flush(rewards);
    // Own redemptions are paginated on the server (pending first).
    httpMock
      .expectOne(`${api}/customer/loyalty/redemptions?page=1&pageSize=25`)
      .flush({ items: redemptions, page: 1, pageSize: 25, totalCount: redemptions.length });
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyLoyaltyPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MyLoyaltyPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the balance, the reserved points, the rewards, the redemptions and the movements', async () => {
    flushAll(points, catalog, [pending]);
    await settle();

    expect(text()).toContain('Disponibles');
    expect(text()).toContain('Reservados para canjes');
    expect(text()).toContain('Membresía: Oro');
    expect(text()).toContain('+30');
    expect(text()).toContain('Retiro por anulación de membresía');
    expect(text()).toContain('Reservado para un canje');
    // A delivery does not take points again: it is shown without a sign.
    expect(text()).toContain('Canje entregado (usa los puntos ya reservados)');
    expect(text()).not.toContain('−25');
    expect(text()).toContain('Gorra');
    expect(text()).toContain('Puntos insuficientes');
    expect(text()).toContain('Llavero');
    expect(text()).toContain('Pendiente de aprobación');
    expect(text()).toContain('Cancelar canje');
    expect(text()).not.toContain('pendientes por compensar');
  });

  it('asks for confirmation, keeps the key on a retry and reloads after a request', async () => {
    flushAll(points, catalog, []);
    await settle();

    component.askToRedeem(catalog.rewards[0]);
    fixture.detectChanges();
    expect(text()).toContain('Se reservarán 40 puntos');

    const failing = component.redeem();
    const first = httpMock.expectOne(`${api}/customer/loyalty/redemptions`);
    expect(first.request.body.rewardId).toBe('r-1');
    first.flush({ title: 'Conflict', detail: 'No hay puntos suficientes.' }, { status: 409, statusText: 'Conflict' });
    await failing;
    expect(component.actionError()).toContain('No hay puntos suficientes');

    const retrying = component.redeem();
    const second = httpMock.expectOne(`${api}/customer/loyalty/redemptions`);
    expect(second.request.body.idempotencyKey).toBe(first.request.body.idempotencyKey);
    second.flush({ ...pending, rewardName: 'Gorra', pointsCost: 40 });
    await settle();
    flushAll({ ...points, availablePoints: 10, reservedPoints: 40 }, catalog, [{ ...pending, rewardName: 'Gorra', pointsCost: 40 }]);
    await retrying;
    await settle();
    expect(component.confirming()).toBeNull();
    expect(text()).toContain('Gorra');
  });

  it('cancels its own redemption and reloads', async () => {
    flushAll(points, catalog, [pending]);
    await settle();

    const cancelling = component.cancel(pending);
    const request = httpMock.expectOne(`${api}/customer/loyalty/redemptions/d-1/cancel`);
    expect(request.request.body).toEqual({ reason: null });
    request.flush({ ...pending, status: 'Cancelled', canCancel: false });
    await settle();
    flushAll(points, catalog, [{ ...pending, status: 'Cancelled', canCancel: false }]);
    await cancelling;
    await settle();
    expect(text()).toContain('Cancelado');
  });

  it('points to the customer profile page when there is no profile yet', async () => {
    flushAll(
      {
        hasProfile: false,
        programEnabled: false,
        availablePoints: 0,
        debtPoints: 0,
        expiringSoonPoints: 0,
        nextExpiresOn: null,
        reservedPoints: 0,
        lots: [],
        movements: [],
      },
      { hasProfile: false, programEnabled: false, availablePoints: 0, rewards: [] },
      [],
    );
    await settle();

    expect(text()).toContain('Aún no tienes perfil de cliente');
    expect(fixture.nativeElement.querySelector('a[href="/customer/customer-profile"]')).toBeTruthy();
  });
});
