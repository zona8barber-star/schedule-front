import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { AdminCashClosingPageComponent } from './admin-cash-closing-page.component';

// ADR-0021 L2: «Cierre de caja» on its own page, for whoever holds reports.cash.view.
describe('AdminCashClosingPageComponent', () => {
  it('opens on today and follows the presets', async () => {
    TestBed.configureTestingModule({
      imports: [AdminCashClosingPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminCashClosingPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const today = bogotaToday();
    const first = httpMock.expectOne((request) => request.url.endsWith('/admin/reports/cash'));
    expect([first.request.params.get('from'), first.request.params.get('to')]).toEqual([today, today]);
    first.flush({ from: today, to: today, days: [], methods: [], billCount: 0, total: 0, voidedCount: 0, voidedTotal: 0 });
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Cierre de caja');

    // On the first day of a month «Este mes» is today again: nothing new to load.
    fixture.componentInstance.setThisMonth();
    fixture.detectChanges();
    expect(fixture.componentInstance.from()).toBe(`${today.slice(0, 8)}01`);
    if (!today.endsWith('-01')) {
      const month = httpMock.expectOne((request) => request.url.endsWith('/admin/reports/cash'));
      expect(month.request.params.get('from')).toBe(`${today.slice(0, 8)}01`);
      month.flush({ from: today, to: today, days: [], methods: [], billCount: 0, total: 0, voidedCount: 0, voidedTotal: 0 });
    }
    httpMock.verify();
  });
});
