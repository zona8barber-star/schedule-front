import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  BILL_LINE_TYPE_LABELS,
  MY_BILL_STATUS_LABELS,
  MyBillLineView,
  MyBillView,
  TIP_PAYMENT_MODE_LABELS,
} from '../../../../../core/models/bill.models';
import { CustomerBillsApiService } from '../../../../../core/services/customer-bills-api.service';
import { formatCop } from '../../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { bogotaDateTimeFormat } from '../../../../../core/utils/bogota-date.utils';
import { isGuid, isNotFoundError } from '../../../../../core/utils/route-id.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { NotFoundStateComponent } from '../../../../../shared/components/not-found-state/not-found-state.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

const DATE_TIME = bogotaDateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * One receipt of the signed-in customer (ADR-0020 stage 5): lines, discounts, tip, total and payment method. Being
 * corrected it shows «En revisión» with the current values; voided, «Anulado» (Q23).
 */
@Component({
  selector: 'app-customer-bill-detail-page',
  imports: [RouterLink, ApiFeedbackComponent, NotFoundStateComponent, PageStateComponent],
  templateUrl: './customer-bill-detail-page.component.html',
  styleUrls: ['../../../memberships/my-memberships.scss', '../../my-bills.scss'],
})
export class CustomerBillDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(CustomerBillsApiService);

  readonly statusLabels = MY_BILL_STATUS_LABELS;
  /** SONDA BUG-124: the page of «Mis recibos de caja» this receipt was opened from, so «←» goes back to it. */
  readonly returnQueryParams = (() => {
    const page = Number(this.route.snapshot?.queryParamMap?.get('page'));
    return Number.isInteger(page) && page > 1 ? { page } : null;
  })();
  readonly formatCop = formatCop;
  readonly bill = signal<MyBillView | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly notFound = signal(false);

  /** Discounts are shown in the totals; tips apart, with how they were paid. */
  readonly items = computed(() => (this.bill()?.lines ?? []).filter((line) => line.type !== 'Discount' && line.type !== 'Tip'));
  readonly tips = computed(() => (this.bill()?.lines ?? []).filter((line) => line.type === 'Tip'));

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const billId = params.get('billId');
      if (billId) {
        void this.load(billId);
      }
    });
  }

  formatDateTime(value: string): string {
    return DATE_TIME.format(new Date(value));
  }

  lineLabel(line: MyBillLineView): string {
    return line.isCourtesy ? 'Cortesía' : BILL_LINE_TYPE_LABELS[line.type];
  }

  tipLabel(line: MyBillLineView): string {
    const mode = line.tipPaymentMode ? TIP_PAYMENT_MODE_LABELS[line.tipPaymentMode] : '';
    return [line.staffName, mode].filter(Boolean).join(' · ');
  }

  private async load(billId: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.notFound.set(false);
    if (!isGuid(billId)) {
      this.bill.set(null);
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }
    try {
      this.bill.set(await firstValueFrom(this.api.getById(billId)));
    } catch (error) {
      this.bill.set(null);
      if (isNotFoundError(error)) {
        this.notFound.set(true);
      } else {
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
