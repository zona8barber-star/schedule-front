import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { MY_BILL_STATUS_LABELS, MyBillSummaryView } from '../../../../../core/models/bill.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { CustomerBillsApiService } from '../../../../../core/services/customer-bills-api.service';
import { formatCop } from '../../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { bogotaDateTimeFormat } from '../../../../../core/utils/bogota-date.utils';
import { readPageParam, toQueryParams } from '../../../../../core/utils/list-query.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';

const DATE_TIME = bogotaDateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * «Mis recibos de caja» (ADR-0020 stage 5, P8): the receipts of the signed-in customer's bills, with those of the profiles
 * merged into their own, newest first. Only the number, the date, the total and the payment method; a voided receipt
 * shows «Anulado» and one being corrected «En revisión» (Q23).
 */
@Component({
  selector: 'app-customer-bills-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent, PaginatorComponent],
  templateUrl: './customer-bills-page.component.html',
  styleUrls: ['../../../memberships/my-memberships.scss', '../../my-bills.scss'],
})
export class CustomerBillsPageComponent implements OnInit {
  private readonly api = inject(CustomerBillsApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly statusLabels = MY_BILL_STATUS_LABELS;
  readonly formatCop = formatCop;
  readonly pageSize = DEFAULT_PAGE_SIZE;
  readonly bills = signal<MyBillSummaryView[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.page.set(readPageParam(params));
      void this.load();
    });
  }

  formatDateTime(value: string): string {
    return DATE_TIME.format(new Date(value));
  }

  onPageChange(page: number): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams({ page }), queryParamsHandling: 'merge' });
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(this.api.list({ page: this.page(), pageSize: this.pageSize }));
      if (sequence === this.loadSequence) {
        this.bills.set(result.items);
        this.totalCount.set(result.totalCount);
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.errorMessage.set(getApiErrorMessage(error));
        this.bills.set([]);
        this.totalCount.set(0);
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
