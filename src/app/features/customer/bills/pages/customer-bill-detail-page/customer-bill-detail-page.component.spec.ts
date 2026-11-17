import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { environment } from '../../../../../../environments/environment';
import { MyBillView } from '../../../../../core/models/bill.models';
import { CustomerBillDetailPageComponent } from './customer-bill-detail-page.component';

describe('CustomerBillDetailPageComponent', () => {
  let httpMock: HttpTestingController;
  const billId = '6f9619ff-8b86-4d11-b42d-00c04fc964ff';
  const url = `${environment.defaultApiBaseUrl}/customer/bills/${billId}`;

  const receipt = (overrides: Partial<MyBillView> = {}): MyBillView => ({
    id: billId,
    number: 'C-000007',
    status: 'Issued',
    serviceDate: '2026-11-14',
    closedAt: '2026-11-14T20:00:00Z',
    customerName: 'Carla Cliente',
    lines: [
      { type: 'Service', name: 'Corte', quantity: 1, unitPrice: 30000, amount: 30000, isCourtesy: false, staffName: 'Alex', tipPaymentMode: null },
      { type: 'Product', name: 'Cera mate', quantity: 2, unitPrice: 35000, amount: 70000, isCourtesy: false, staffName: null, tipPaymentMode: null },
      { type: 'Discount', name: 'Descuento', quantity: 1, unitPrice: -5000, amount: -5000, isCourtesy: false, staffName: null, tipPaymentMode: null },
      { type: 'Tip', name: 'Propina', quantity: 1, unitPrice: 4000, amount: 4000, isCourtesy: false, staffName: 'Alex', tipPaymentMode: 'WithBill' },
    ],
    subtotal: 100000,
    discountTotal: 5000,
    tipTotal: 4000,
    directTipTotal: 0,
    total: 99000,
    paymentMethodName: 'Nequi',
    ...overrides,
  });

  async function render(id: string, answer?: (request: ReturnType<HttpTestingController['expectOne']>) => void) {
    TestBed.configureTestingModule({
      imports: [CustomerBillDetailPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ billId: id })) } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CustomerBillDetailPageComponent);
    fixture.detectChanges();
    if (answer) {
      answer(httpMock.expectOne(url));
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => httpMock.verify());

  it('shows the lines, the discount, the tip, the total and the payment method', async () => {
    const element = await render(billId, (request) => request.flush(receipt()));

    const lines = element.querySelector('[data-testid="bill-lines"]')!.textContent!;
    expect(lines).toContain('Corte');
    expect(lines).toContain('2 × Cera mate');
    expect(lines).not.toContain('Descuento');
    const totals = element.querySelector('[data-testid="bill-totals"]')!.textContent!;
    expect(totals).toContain('-$ 5.000');
    expect(totals).toContain('Propina (Alex · Cobrada con la cuenta)');
    expect(totals).toContain('$ 99.000');
    expect(totals).toContain('Nequi');
    expect(element.querySelector('[data-testid="bill-status"]')!.textContent!.trim()).toBe('Emitido');
  });

  it('marks a receipt being corrected as «En revisión» with its current values', async () => {
    const element = await render(billId, (request) => request.flush(receipt({ status: 'UnderReview' })));

    expect(element.querySelector('[data-testid="bill-status"]')!.textContent!.trim()).toBe('En revisión');
    expect(element.querySelector('[data-testid="bill-under-review"]')).not.toBeNull();
  });

  it('marks a voided receipt as «Anulado»', async () => {
    const element = await render(billId, (request) => request.flush(receipt({ status: 'Voided' })));

    expect(element.querySelector('[data-testid="bill-status"]')!.textContent!.trim()).toBe('Anulado');
    expect(element.querySelector('[data-testid="bill-voided"]')).not.toBeNull();
  });

  it('answers a receipt of someone else like a missing one', async () => {
    const element = await render(billId, (request) => request.flush({}, { status: 404, statusText: 'Not Found' }));

    expect(element.textContent).toContain('No encontramos este recibo de caja');
  });

  it('never asks for an id that is not a GUID', async () => {
    const element = await render('abc');

    expect(element.textContent).toContain('No encontramos este recibo de caja');
  });
});
