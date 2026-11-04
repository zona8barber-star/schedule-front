import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { environment } from '../../../../../../environments/environment';
import { PERMISSION_CODES, PermissionCode } from '../../../../../core/models/auth.models';
import { LoyaltyWalletView } from '../../../../../core/models/loyalty-wallet.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { AdminCustomerLoyaltyPanelComponent } from './admin-customer-loyalty-panel.component';

describe('AdminCustomerLoyaltyPanelComponent', () => {
  let fixture: ComponentFixture<AdminCustomerLoyaltyPanelComponent>;
  let component: AdminCustomerLoyaltyPanelComponent;
  let httpMock: HttpTestingController;
  const url = `${environment.defaultApiBaseUrl}/admin/customers/c-1/loyalty`;

  const wallet: LoyaltyWalletView = {
    customerId: 'c-1',
    liveCustomerId: 'c-1',
    isMerged: false,
    programEnabled: true,
    availablePoints: 50,
    debtPoints: 0,
    expiringSoonPoints: 20,
    nextExpiresOn: '2026-11-12',
    lots: [
      {
        id: 'l-1',
        sourceType: 'Membership',
        sourceId: 'm-1',
        sourceLabel: 'Membresía: Oro',
        initialPoints: 40,
        remainingPoints: 20,
        usablePoints: 20,
        accruedOn: '2026-11-03',
        validityDays: 10,
        expiresOn: '2026-11-12',
        isExpired: false,
        originLotId: 'l-0',
        originCustomerId: 'c-2',
      },
    ],
    debts: [],
    movements: [
      {
        id: 'mv-1',
        type: 'MergeTransferIn',
        points: 40,
        lotId: 'l-1',
        debtId: null,
        reason: null,
        relatedCustomerId: 'c-2',
        performedByName: 'Admin',
        performedAt: '2026-11-03T15:00:00Z',
      },
    ],
  };

  async function render(permissions: PermissionCode[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminCustomerLoyaltyPanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { hasPermission: (code: PermissionCode) => permissions.includes(code) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCustomerLoyaltyPanelComponent);
    component = fixture.componentInstance;
    component.customerId = 'c-1';
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(url).flush(wallet);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the balance, the lots with their expiry and origin, and no adjustment form without the permission', async () => {
    await render([]);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Disponibles');
    expect(text).toContain('50');
    expect(text).toContain('20 / 40 pts');
    expect(text).toContain('Membresía: Oro');
    expect(text).toContain('recibido por fusión');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();

    component.showHistory.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('+40');
    expect(fixture.nativeElement.textContent).toContain('Recibido por fusión');
  });

  it('keeps the idempotency key while retrying an adjustment and renews it after a success', async () => {
    await render([PERMISSION_CODES.loyaltyPointsAdjust]);
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();

    component.direction = 'Debit';
    component.points = 60;
    component.reason = 'Corrección de saldo';
    const failing = component.adjust();
    const first = httpMock.expectOne(`${url}/adjustments`);
    first.flush(
      { title: 'Conflict', detail: 'Solo puedes descontar hasta 50 punto(s) disponibles; un cargo nunca genera deuda.' },
      { status: 409, statusText: 'Conflict' },
    );
    await failing;
    expect(component.adjustError()).toContain('nunca genera deuda');

    component.points = 10;
    const retrying = component.adjust();
    const second = httpMock.expectOne(`${url}/adjustments`);
    expect(second.request.body.idempotencyKey).toBe(first.request.body.idempotencyKey);
    expect(second.request.body).toEqual(expect.objectContaining({ direction: 'Debit', points: 10, reason: 'Corrección de saldo' }));
    second.flush({ ...wallet, availablePoints: 40 });
    await retrying;
    expect(component.wallet()?.availablePoints).toBe(40);

    component.points = 5;
    component.reason = 'Otro ajuste';
    const next = component.adjust();
    const third = httpMock.expectOne(`${url}/adjustments`);
    expect(third.request.body.idempotencyKey).not.toBe(first.request.body.idempotencyKey);
    third.flush(wallet);
    await next;
  });
});
