import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { firstValueFrom } from 'rxjs';

import { CashClosingView } from '../../../../../core/models/bill.models';
import { ReportSummaryView } from '../../../../../core/models/report.models';
import { AdminReportsApiService } from '../../../../../core/services/admin-reports-api.service';
import { BillsApiService } from '../../../../../core/services/bills-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { historyRangeError } from '../../../../../core/utils/history-range.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

/** First day of the current Bogotá month: "today" is Bogotá's, whatever the device timezone (SONDA BUG-033). */
function bogotaMonthStart(): string {
  return `${bogotaToday().slice(0, 8)}01`;
}

@Component({
  selector: 'app-admin-reports-page',
  imports: [FormsModule, DecimalPipe, BaseChartDirective, ApiFeedbackComponent],
  templateUrl: './admin-reports-page.component.html',
  styleUrl: './admin-reports-page.component.scss',
})
export class AdminReportsPageComponent implements OnInit {
  private readonly api = inject(AdminReportsApiService);
  private readonly billsApi = inject(BillsApiService);

  readonly from = signal(bogotaMonthStart());
  readonly to = signal(bogotaToday());
  readonly summary = signal<ReportSummaryView | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  /** Increases with every load; an answer whose number is no longer the latest is ignored (SONDA BUG-082). */
  private loadSequence = 0;

  /** ADR-0020 stage 5: what was charged by day and payment method; at most 30 days per query. */
  readonly cash = signal<CashClosingView | null>(null);
  readonly cashError = signal<string | null>(null);
  readonly isLoadingCash = signal(false);
  private cashSequence = 0;

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
      // Promo and normal are service income; with membership sales the three slices add up to total income.
      labels: ['Promo', 'Normal', 'Membresías'],
      datasets: [
        { data: [summary?.promoIncome ?? 0, summary?.normalIncome ?? 0, summary?.membershipSalesIncome ?? 0] },
      ],
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
    this.reload();
  }

  onFromChange(value: string): void {
    this.from.set(value);
    this.reload();
  }

  onToChange(value: string): void {
    this.to.set(value);
    this.reload();
  }

  setToday(): void {
    const today = bogotaToday();
    this.from.set(today);
    this.to.set(today);
    this.reload();
  }

  setThisMonth(): void {
    this.from.set(bogotaMonthStart());
    this.to.set(bogotaToday());
    this.reload();
  }

  private reload(): void {
    void this.load();
    void this.loadCash();
  }

  private async loadCash(): Promise<void> {
    const sequence = ++this.cashSequence;
    const rangeError = historyRangeError(this.from(), this.to());
    this.cashError.set(rangeError);
    if (rangeError) {
      // The API would reject it too (422); the rest of the report still covers the range.
      this.cash.set(null);
      this.isLoadingCash.set(false);
      return;
    }
    this.isLoadingCash.set(true);
    try {
      const cash = await firstValueFrom(this.billsApi.cashClosing(this.from(), this.to()));
      if (sequence === this.cashSequence) {
        this.cash.set(cash);
      }
    } catch (error) {
      if (sequence === this.cashSequence) {
        this.cash.set(null);
        this.cashError.set(getApiErrorMessage(error));
      }
    } finally {
      if (sequence === this.cashSequence) {
        this.isLoadingCash.set(false);
      }
    }
  }

  private async load(): Promise<void> {
    // SONDA BUG-082: only the answer of the latest range is shown; a slower answer of an earlier range is dropped
    // (same pattern as the income list).
    const sequence = ++this.loadSequence;
    if (this.from() > this.to()) {
      this.errorMessage.set('La fecha "desde" debe ser anterior o igual a "hasta".');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const summary = await firstValueFrom(this.api.getSummary(this.from(), this.to()));
      if (sequence !== this.loadSequence) return;
      this.summary.set(summary);
    } catch (error) {
      if (sequence !== this.loadSequence) return;
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
