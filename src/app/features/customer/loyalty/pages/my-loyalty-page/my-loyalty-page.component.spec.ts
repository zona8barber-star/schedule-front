import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { MyLoyaltyView } from '../../../../../core/models/loyalty-wallet.models';
import { MyLoyaltyPageComponent } from './my-loyalty-page.component';

describe('MyLoyaltyPageComponent', () => {
  let fixture: ComponentFixture<MyLoyaltyPageComponent>;
  let httpMock: HttpTestingController;
  const api = environment.defaultApiBaseUrl;

  async function render(view: MyLoyaltyView): Promise<string> {
    httpMock.expectOne(`${api}/customer/loyalty`).flush(view);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyLoyaltyPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MyLoyaltyPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the balance, the points by expiry and the recent movements', async () => {
    const text = await render({
      hasProfile: true,
      programEnabled: true,
      availablePoints: 50,
      debtPoints: 0,
      expiringSoonPoints: 20,
      nextExpiresOn: '2026-11-12',
      lots: [
        { usablePoints: 20, accruedOn: '2026-11-03', expiresOn: '2026-11-12', sourceLabel: 'Membresía: Oro' },
        { usablePoints: 30, accruedOn: '2026-11-03', expiresOn: '2027-11-02', sourceLabel: 'Servicio: Corte' },
      ],
      movements: [
        { type: 'Accrual', points: 30, performedAt: '2026-11-03T15:00:00Z' },
        { type: 'MembershipAnnulmentWithdrawal', points: 20, performedAt: '2026-11-03T16:00:00Z' },
      ],
    });

    expect(text).toContain('Disponibles');
    expect(text).toContain('50');
    expect(text).toContain('20 pts');
    expect(text).toContain('Membresía: Oro');
    expect(text).toContain('+30');
    expect(text).toContain('−20');
    expect(text).toContain('Retiro por anulación de membresía');
    expect(text).not.toContain('pendientes por compensar');
  });

  it('points to the customer profile page when there is no profile yet', async () => {
    const text = await render({
      hasProfile: false,
      programEnabled: false,
      availablePoints: 0,
      debtPoints: 0,
      expiringSoonPoints: 0,
      nextExpiresOn: null,
      lots: [],
      movements: [],
    });

    expect(text).toContain('Aún no tienes perfil de cliente');
    expect(fixture.nativeElement.querySelector('a[href="/customer/customer-profile"]')).toBeTruthy();
  });
});
