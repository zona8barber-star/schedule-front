import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CashClosingView } from '../../../../../core/models/bill.models';
import { BillsApiService } from '../../../../../core/services/bills-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { historyRangeError } from '../../../../../core/utils/history-range.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

/**
 * ADR-0020 stage 5: what was charged by day and payment method; at most 30 days per query. ADR-0021 L2: shown in
 * «Reportes» (Admin) and in its own page «Cierre de caja» for whoever holds reports.cash.view.
 */
@Component({
  selector: 'app-cash-closing-panel',
  imports: [DecimalPipe, ApiFeedbackComponent],
  templateUrl: './cash-closing-panel.component.html',
  styleUrl: '../../pages/admin-reports-page/admin-reports-page.component.scss',
})
export class CashClosingPanelComponent {
  private readonly billsApi = inject(BillsApiService);

  readonly from = input.required<string>();
  readonly to = input.required<string>();
  /** The page title already says «Cierre de caja»; inside «Reportes» the panel carries its own heading. */
  readonly showHeading = input(true);

  readonly cash = signal<CashClosingView | null>(null);
  readonly cashError = signal<string | null>(null);
  readonly isLoadingCash = signal(false);
  /** Increases with every load; an answer whose number is no longer the latest is ignored (SONDA BUG-082). */
  private cashSequence = 0;

  constructor() {
    effect(() => {
      void this.loadCash(this.from(), this.to());
    });
  }

  private async loadCash(from: string, to: string): Promise<void> {
    const sequence = ++this.cashSequence;
    const rangeError = historyRangeError(from, to);
    this.cashError.set(rangeError);
    if (rangeError) {
      // The API would reject it too (422).
      this.cash.set(null);
      this.isLoadingCash.set(false);
      return;
    }
    this.isLoadingCash.set(true);
    try {
      const cash = await firstValueFrom(this.billsApi.cashClosing(from, to));
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
}
