import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { PERMISSION_CODES, PermissionCode } from '../../../../../core/models/auth.models';
import { LoyaltyRedemptionView } from '../../../../../core/models/loyalty-redemption.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { defaultHistoryRange } from '../../../../../core/utils/history-range.utils';
import { AdminLoyaltyRedemptionsPageComponent } from './admin-loyalty-redemptions-page.component';

describe('AdminLoyaltyRedemptionsPageComponent', () => {
  let fixture: ComponentFixture<AdminLoyaltyRedemptionsPageComponent>;
  let component: AdminLoyaltyRedemptionsPageComponent;
  let httpMock: HttpTestingController;
  const api = `${environment.defaultApiBaseUrl}/admin/loyalty/redemptions`;

  const requested: LoyaltyRedemptionView = {
    id: 'd-1',
    customerId: 'c-1',
    customerName: 'Carla Cliente',
    rewardId: 'r-1',
    rewardName: 'Gorra',
    rewardKind: 'Other',
    serviceId: null,
    serviceName: null,
    pointsCost: 30,
    status: 'Requested',
    channel: 'App',
    inPersonVerified: false,
    requestedAt: '2026-11-04T15:00:00Z',
    requestedByName: 'Carla Cliente',
    requestedOn: '2026-11-04',
    approvalDays: 30,
    deliveryDays: 30,
    approveBy: '2026-12-03',
    approvedAt: null,
    approvedByName: null,
    deliverBy: null,
    deliveredAt: null,
    deliveredByName: null,
    serviceRecordId: null,
    rejectedAt: null,
    rejectedByName: null,
    rejectionReason: null,
    cancelledAt: null,
    cancelledByName: null,
    cancellationReason: null,
    cancelledByCustomer: false,
    expiredAt: null,
    isPastDeadline: false,
    allocations: [{ lotId: 'l-1', points: 30, expiresOn: '2027-11-03' }],
    version: 11,
  };

  const approvedService: LoyaltyRedemptionView = {
    ...requested,
    id: 'd-2',
    rewardName: 'Corte gratis',
    rewardKind: 'Service',
    serviceId: 's-1',
    serviceName: 'Corte',
    status: 'Approved',
    approvedAt: '2026-11-04T16:00:00Z',
    approvedByName: 'Admin',
    deliverBy: '2026-12-03',
    version: 12,
  };

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function render(permissions: PermissionCode[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminLoyaltyRedemptionsPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { hasPermission: (code: PermissionCode) => permissions.includes(code) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLoyaltyRedemptionsPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  // The queues never send dates, so an old pending redemption is never hidden.
  const requestedUrl = `${api}?status=Requested&page=1&pageSize=25`;

  function pageOf(items: LoyaltyRedemptionView[]) {
    return { items, page: 1, pageSize: 25, totalCount: items.length };
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('approves a request with the version read and reloads the inbox', async () => {
    await render([PERMISSION_CODES.loyaltyRedemptionsApprove]);
    httpMock.expectOne(requestedUrl).flush(pageOf([requested]));
    await settle();
    expect(component.tabs.map((tab) => tab.id)).toEqual(['Requested', 'History']);
    expect(text()).toContain('Gorra · 30 pts');
    expect(text()).toContain('Carla Cliente');

    const approving = component.approve(requested);
    const request = httpMock.expectOne(`${api}/d-1/approve`);
    expect(request.request.body).toEqual({ version: 11 });
    request.flush({ ...requested, status: 'Approved' });
    await settle();
    httpMock.expectOne(requestedUrl).flush(pageOf([]));
    await approving;
    await settle();
    expect(component.successMessage()).toBe('Canje aprobado.');
  });

  it('requires a reason to reject and sends it', async () => {
    await render([PERMISSION_CODES.loyaltyRedemptionsApprove]);
    httpMock.expectOne(requestedUrl).flush(pageOf([requested]));
    await settle();

    component.startReason(requested, 'reject');
    component.reason = 'no';
    await component.confirmReason(requested);
    expect(component.errorMessage()).toContain('al menos 3');

    component.reason = 'Sin existencias';
    const rejecting = component.confirmReason(requested);
    const request = httpMock.expectOne(`${api}/d-1/reject`);
    expect(request.request.body).toEqual({ version: 11, reason: 'Sin existencias' });
    request.flush({ ...requested, status: 'Rejected' });
    await settle();
    httpMock.expectOne(requestedUrl).flush(pageOf([]));
    await rejecting;
  });

  it('only offers a direct delivery for "other" rewards; a service reward goes through its service record', async () => {
    await render([PERMISSION_CODES.loyaltyRedemptionsDeliver]);
    expect(component.tabs.map((tab) => tab.id)).toEqual(['Deliveries']);
    const approvedOther = { ...requested, id: 'd-3', status: 'Approved' as const, deliverBy: '2026-12-03', version: 13 };
    httpMock.expectOne(`${api}/deliveries?page=1&pageSize=25`).flush(pageOf([approvedService, approvedOther]));
    await settle();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .map((button) => button.textContent?.trim());
    expect(buttons.filter((label) => label === 'Marcar entregado')).toHaveLength(1);
    expect(buttons).not.toContain('Cancelar canje');
    expect(text()).toContain('Se entrega al confirmar el servicio realizado');

    const delivering = component.deliver(approvedOther);
    const request = httpMock.expectOne(`${api}/d-3/deliver`);
    expect(request.request.body).toEqual({ version: 13 });
    request.flush({ ...approvedOther, status: 'Delivered' });
    await settle();
    httpMock.expectOne(`${api}/deliveries?page=1&pageSize=25`).flush(pageOf([approvedService]));
    await delivering;
  });

  it('pages the history with its status and date filters kept in the URL', async () => {
    await render([PERMISSION_CODES.loyaltyRedemptionsApprove]);
    httpMock.expectOne(requestedUrl).flush(pageOf([requested]));
    await settle();

    component.selectTab('History');
    await settle();
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/?tab=History');
    // The history asks for the last 30 days by default.
    const { from, to } = defaultHistoryRange();
    httpMock.expectOne(`${api}?from=${from}&to=${to}&page=1&pageSize=25`).flush({ items: [requested], page: 1, pageSize: 25, totalCount: 60 });
    await settle();
    expect(text()).toContain('Página 1 de 3');

    component.onFilterChange({ status: 'Expired', from: '2026-11-01' });
    await settle();
    expect(router.url).toBe('/?tab=History&status=Expired&from=2026-11-01');
    httpMock.expectOne(`${api}?status=Expired&from=2026-11-01&to=2026-11-30&page=1&pageSize=25`).flush(pageOf([]));
    await settle();
    expect(text()).toContain('No hay canjes para estos filtros.');

    // A pending status chosen in the history is a queue again: no dates.
    component.onFilterChange({ status: 'Approved', from: null });
    await settle();
    httpMock.expectOne(`${api}?status=Approved&page=1&pageSize=25`).flush(pageOf([]));
    await settle();

    // A hand-written range of 31 days is explained instead of being sent.
    await router.navigateByUrl('/?tab=History&from=2026-01-01&to=2026-01-31');
    await settle();
    httpMock.expectNone((request) => request.url === api);
    expect(component.rangeError()).toContain('30 días');
  });

  it('explains a revoked permission', async () => {
    await render([PERMISSION_CODES.loyaltyRedemptionsApprove]);
    httpMock.expectOne(requestedUrl).flush(pageOf([requested]));
    await settle();

    const approving = component.approve(requested);
    httpMock.expectOne(`${api}/d-1/approve`).flush(null, { status: 403, statusText: 'Forbidden' });
    await approving;
    expect(component.errorMessage()).toContain('Ya no tienes permiso');
  });
});
