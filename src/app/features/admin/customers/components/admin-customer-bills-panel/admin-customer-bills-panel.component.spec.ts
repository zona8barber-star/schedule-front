import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { PERMISSION_CODES, PermissionCode } from '../../../../../core/models/auth.models';
import { BillSummaryView } from '../../../../../core/models/bill.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { AdminCustomerBillsPanelComponent } from './admin-customer-bills-panel.component';

describe('AdminCustomerBillsPanelComponent', () => {
  let httpMock: HttpTestingController;
  const url = `${environment.defaultApiBaseUrl}/bills`;

  const summary = (id: string, overrides: Partial<BillSummaryView> = {}): BillSummaryView => ({
    id,
    number: 'C-000003',
    status: 'Approved',
    appointmentId: null,
    customerName: 'Carla',
    isWalkIn: false,
    staffProfileId: 'st-1',
    staffName: 'Alex',
    staffIsActive: true,
    serviceDate: '2026-11-14',
    total: 30000,
    lineCount: 1,
    paymentMethodName: 'Efectivo',
    openedAt: '2026-11-14T15:00:00Z',
    closedAt: '2026-11-14T16:00:00Z',
    isOverdue: false,
    isSelfApproved: false,
    hasRedemptions: false,
    ...overrides,
  });

  function render(granted: PermissionCode[]) {
    TestBed.configureTestingModule({
      imports: [AdminCustomerBillsPanelComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { hasAnyPermission: (codes: readonly PermissionCode[]) => codes.some((code) => granted.includes(code)) },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminCustomerBillsPanelComponent);
    fixture.componentRef.setInput('customerId', 'c-1');
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('lists the latest bills of the customer and links to all of them in «Cuentas»', async () => {
    const fixture = render([PERMISSION_CODES.billsManage]);
    const request = httpMock.expectOne((candidate) => candidate.url === url);
    expect(request.request.params.get('customerId')).toBe('c-1');
    expect(request.request.params.get('pageSize')).toBe('5');
    request.flush({ items: [summary('b-1')], page: 1, pageSize: 5, totalCount: 7 });
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-bill="b-1"]')!.textContent).toContain('C-000003');
    const all = element.querySelector<HTMLAnchorElement>('[data-testid="customer-bills-all"]')!;
    expect(all.textContent).toContain('Ver todas (7)');
    expect(all.getAttribute('href')).toBe('/bills?tab=all&customerId=c-1');
  });

  it('is not shown, nor asked for, without access to «Cuentas»', () => {
    const fixture = render([PERMISSION_CODES.loyaltyPointsAdjust]);

    httpMock.expectNone((candidate) => candidate.url === url);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="customer-bills"]')).toBeNull();
  });
});
