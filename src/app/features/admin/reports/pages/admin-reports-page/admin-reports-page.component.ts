import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { firstValueFrom } from 'rxjs';

import { ReportSummaryView } from '../../../../../core/models/report.models';
import { AdminReportsApiService } from '../../../../../core/services/admin-reports-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-admin-reports-page',
  imports: [FormsModule, DecimalPipe, BaseChartDirective, ApiFeedbackComponent],
  templateUrl: './admin-reports-page.component.html',
  styleUrl: './admin-reports-page.component.scss',
})
export class AdminReportsPageComponent implements OnInit {
  private readonly api = inject(AdminReportsApiService);

  readonly from = signal(isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  readonly to = signal(isoDate(new Date()));
  readonly summary = signal<ReportSummaryView | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
  };

  readonly trendChartData = computed<ChartData<'bar'>>(() => {
    const trend = this.summary()?.trend ?? [];
    return {
      labels: trend.map((point) => point.bucket),
      datasets: [
        { label: 'Ingresos', data: trend.map((point) => point.income) },
        { label: 'Gastos', data: trend.map((point) => point.expenses) },
      ],
    };
  });

  readonly professionalChartData = computed<ChartData<'bar'>>(() => {
    const rows = this.summary()?.byProfessional ?? [];
    return {
      labels: rows.map((row) => row.displayName),
      datasets: [{ label: 'Ingresos', data: rows.map((row) => row.incomeTotal) }],
    };
  });

  readonly promoChartData = computed<ChartData<'doughnut'>>(() => {
    const summary = this.summary();
    return {
      labels: ['Promo', 'Normal'],
      datasets: [{ data: [summary?.promoIncome ?? 0, summary?.normalIncome ?? 0] }],
    };
  });

  readonly conceptChartData = computed<ChartData<'bar'>>(() => {
    const rows = this.summary()?.byExpenseConcept ?? [];
    return {
      labels: rows.map((row) => row.name),
      datasets: [{ label: 'Gastos', data: rows.map((row) => row.total) }],
    };
  });

  ngOnInit(): void {
    void this.load();
  }

  onFromChange(value: string): void {
    this.from.set(value);
    void this.load();
  }

  onToChange(value: string): void {
    this.to.set(value);
    void this.load();
  }

  setToday(): void {
    const today = isoDate(new Date());
    this.from.set(today);
    this.to.set(today);
    void this.load();
  }

  setThisMonth(): void {
    const now = new Date();
    this.from.set(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    this.to.set(isoDate(now));
    void this.load();
  }

  private async load(): Promise<void> {
    if (this.from() > this.to()) {
      this.errorMessage.set('La fecha "desde" debe ser anterior o igual a "hasta".');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.summary.set(await firstValueFrom(this.api.getSummary(this.from(), this.to())));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
