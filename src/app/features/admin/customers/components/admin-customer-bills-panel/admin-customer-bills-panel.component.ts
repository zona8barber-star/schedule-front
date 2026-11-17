import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { BILLS_ACCESS_PERMISSIONS } from '../../../../../core/models/auth.models';
import { BILL_STATUS_LABELS, BillSummaryView } from '../../../../../core/models/bill.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { BillsApiService } from '../../../../../core/services/bills-api.service';
import { formatCop } from '../../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

const RECENT = 5;

/**
 * ADR-0020 stage 5 (P8): the bills of a customer, also one without the app, with those of the profiles merged into it.
 * The latest ones here; «Ver todas» opens «Cuentas» filtered by the customer. Only for whoever can open «Cuentas»; the
 * API decides which bills each one sees.
 */
@Component({
  selector: 'app-admin-customer-bills-panel',
  imports: [RouterLink, ApiFeedbackComponent],
  templateUrl: './admin-customer-bills-panel.component.html',
  styleUrl: '../admin-customer-loyalty-panel/admin-customer-loyalty-panel.component.scss',
})
export class AdminCustomerBillsPanelComponent implements OnChanges {
  private readonly api = inject(BillsApiService);
  private loadSequence = 0;

  @Input({ required: true }) customerId!: string;

  readonly canSeeBills = inject(AuthService).hasAnyPermission(BILLS_ACCESS_PERMISSIONS);
  readonly statusLabels = BILL_STATUS_LABELS;
  readonly formatCop = formatCop;
  readonly bills = signal<BillSummaryView[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnChanges(): void {
    if (this.canSeeBills && this.customerId) {
      void this.load();
    }
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const page = await firstValueFrom(this.api.list({ customerId: this.customerId, page: 1, pageSize: RECENT }));
      if (sequence === this.loadSequence) {
        this.bills.set(page.items);
        this.totalCount.set(page.totalCount);
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
