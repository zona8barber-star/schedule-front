import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ReportSummaryView } from '../../../../../core/models/report.models';
import { AdminReportsPageComponent } from './admin-reports-page.component';

describe('AdminReportsPageComponent', () => {
  const summary: ReportSummaryView = {
    from: '2026-06-01',
    to: '2026-06-30',
    totalIncome: 460000,
    totalExpenses: 0,
    netProfit: 460000,
    incomeCount: 2,
    promoIncome: 10000,
    normalIncome: 20000,
    businessIncome: 442000,
    professionalIncome: 18000,
    byProfessional: [],
    byExpenseConcept: [],
    trend: [],
    membershipSalesIncome: 430000,
    membershipSalesCount: 2,
  };

  // The chart data is checked without rendering: jsdom has no canvas for Chart.js.
  function createComponent(): AdminReportsPageComponent {
    TestBed.configureTestingModule({
      imports: [AdminReportsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.createComponent(AdminReportsPageComponent).componentInstance;
  }

  it('splits income into promo, normal and membership sales that add up to the total', () => {
    const component = createComponent();
    component.summary.set(summary);

    const chart = component.promoChartData();
    expect(chart.labels).toEqual(['Promo', 'Normal', 'Membresías']);
    const slices = chart.datasets[0].data as number[];
    expect(slices).toEqual([10000, 20000, 430000]);
    expect(slices.reduce((sum, value) => sum + value, 0)).toBe(summary.totalIncome);
  });

  it('shows no membership slice value before a summary is loaded', () => {
    const component = createComponent();

    expect(component.promoChartData().datasets[0].data).toEqual([0, 0, 0]);
  });
});
