import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { MyBillSummaryView } from '../../../../../core/models/bill.models';
import { CustomerBillsPageComponent } from './customer-bills-page.component';

describe('CustomerBillsPageComponent', () => {
  let httpMock: HttpTestingController;
  const url = `${environment.defaultApiBaseUrl}/customer/bills`;

  const bill = (overrides: Partial<MyBillSummaryView>): MyBillSummaryView => ({
    id: 'b-1',
    number: 'C-000001',
    status: 'Issued',
    serviceDate: '2026-11-14',
    closedAt: '2026-11-14T20:00:00Z',
    total: 30000,
    paymentMethodName: 'Efectivo',
    ...overrides,
  });

  async function render(items: MyBillSummaryView[]) {
    TestBed.configureTestingModule({
      imports: [CustomerBillsPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CustomerBillsPageComponent);
    fixture.detectChanges();
    httpMock.expectOne((request) => request.url === url).flush({ items, page: 1, pageSize: 20, totalCount: items.length });
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => httpMock.verify());

  it('lists the receipts with their number, total and customer status, linked to their detail', async () => {
    const element = await render([
      bill({ id: 'b-2', number: 'C-000002', status: 'UnderReview', total: 45000 }),
      bill({ id: 'b-1', status: 'Voided' }),
    ]);

    const cards = Array.from(element.querySelectorAll<HTMLAnchorElement>('[data-bill]'));
    expect(cards.map((card) => card.getAttribute('href'))).toEqual(['/customer/bills/b-2', '/customer/bills/b-1']);
    expect(cards[0].textContent).toContain('C-000002');
    expect(cards[0].textContent).toContain('En revisión');
    expect(cards[0].textContent).toContain('$ 45.000');
    expect(cards[1].textContent).toContain('Anulado');
    // Never the internal states of the bill.
    expect(element.textContent).not.toContain('Aprobada');
    expect(element.textContent).not.toContain('Comisión');
  });

  it('explains how to see the receipts when there are none', async () => {
    const element = await render([]);

    expect(element.textContent).toContain('Aún no tienes recibos de caja');
    expect(element.querySelector('a[href="/customer/customer-profile"]')).not.toBeNull();
  });
});
