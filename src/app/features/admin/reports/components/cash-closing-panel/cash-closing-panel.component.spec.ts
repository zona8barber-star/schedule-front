import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CashClosingPanelComponent } from './cash-closing-panel.component';

// ADR-0020 stage 5 and ADR-0021 L2: the cash closing, shared by «Reportes» and its own page «Cierre de caja».
describe('CashClosingPanelComponent', () => {
  const cashClosing = {
    from: '2026-06-01',
    to: '2026-06-02',
    days: [],
    methods: [{ paymentMethodId: 'pm-1', name: 'Efectivo', billCount: 2, total: 75000 }],
    billCount: 2,
    total: 75000,
    voidedCount: 1,
    voidedTotal: 30000,
  };
  let fixture: ComponentFixture<CashClosingPanelComponent>;
  let httpMock: HttpTestingController;

  function create(from: string, to: string): CashClosingPanelComponent {
    TestBed.configureTestingModule({
      imports: [CashClosingPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CashClosingPanelComponent);
    fixture.componentRef.setInput('from', from);
    fixture.componentRef.setInput('to', to);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => httpMock.verify());

  it('loads the cash closing of the range, and explains a range longer than 30 days instead of asking', async () => {
    const component = create('2026-06-01', '2026-06-02');
    const cash = httpMock.expectOne((request) => request.url.endsWith('/admin/reports/cash'));
    expect(cash.request.params.get('from')).toBe('2026-06-01');
    expect(cash.request.params.get('to')).toBe('2026-06-02');
    cash.flush(cashClosing);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(component.cash()?.total).toBe(75000);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="cash-voided"]')?.textContent).toContain('Anuladas: 1 cuenta');

    fixture.componentRef.setInput('from', '2026-01-01');
    fixture.detectChanges();
    httpMock.expectNone((request) => request.url.endsWith('/admin/reports/cash'));
    expect(component.cashError()).toContain('30 días');
    expect(component.cash()).toBeNull();
  });

  it('hides its own heading inside the page that is already called «Cierre de caja»', () => {
    create('2026-06-01', '2026-06-01');
    fixture.componentRef.setInput('showHeading', false);
    fixture.detectChanges();
    httpMock.expectOne((request) => request.url.endsWith('/admin/reports/cash')).flush(cashClosing);

    expect((fixture.nativeElement as HTMLElement).querySelector('h2')).toBeNull();
  });
});
