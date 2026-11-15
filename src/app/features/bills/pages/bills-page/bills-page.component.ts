import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  BILL_STATUS_LABELS,
  BillCustomerOption,
  BillOptionsView,
  BillPendingView,
  BillStatus,
  BillSummaryView,
} from '../../../../core/models/bill.models';
import { newIdempotencyKey } from '../../../../core/models/loyalty-redemption.models';
import { DEFAULT_PAGE_SIZE } from '../../../../core/models/paged-result.models';
import { BillsApiService } from '../../../../core/services/bills-api.service';
import { formatCop } from '../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.utils';
import { bogotaDateTimeFormat } from '../../../../core/utils/bogota-date.utils';
import { trimmedMinLength } from '../../../../core/utils/form-validators';
import {
  QueryValue,
  readOptionParam,
  readPageParam,
  readTextParam,
  toQueryParams,
} from '../../../../core/utils/list-query.utils';
import { SingleFlight } from '../../../../core/utils/single-flight';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { FormA11yDirective } from '../../../../shared/directives/form-a11y.directive';
import { ModalDialogDirective } from '../../../../shared/directives/modal-dialog.directive';

export const BILL_TABS = ['pending', 'Closed', 'Unapproved', 'Approved', 'Voided'] as const;
export type BillTab = (typeof BILL_TABS)[number];

const DATE_TIME = bogotaDateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * «Cuentas» (ADR-0020): the bills to close (open ones, overdue after 7 days, and completed appointments without a bill,
 * BUG-092), the approval tray and the history. A professional sees their own bills; whoever manages, approves or voids
 * bills sees all of them. The tab, the search and the page live in the URL.
 */
@Component({
  selector: 'app-bills-page',
  imports: [FormA11yDirective, ModalDialogDirective, ReactiveFormsModule, RouterLink, ApiFeedbackComponent, PaginatorComponent],
  templateUrl: './bills-page.component.html',
  styleUrls: ['../../../admin/service-catalog/catalog-page.scss', '../../bills.scss'],
})
export class BillsPageComponent implements OnInit {
  private readonly api = inject(BillsApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;
  private openKey = newIdempotencyKey();

  readonly statusLabels = BILL_STATUS_LABELS;
  readonly formatCop = formatCop;
  readonly pageSize = DEFAULT_PAGE_SIZE;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly options = signal<BillOptionsView | null>(null);
  readonly tab = signal<BillTab>('pending');
  readonly query = signal('');
  readonly page = signal(1);
  readonly totalCount = signal(0);
  readonly pending = signal<BillPendingView | null>(null);
  readonly bills = signal<BillSummaryView[]>([]);

  readonly isOpening = signal(false);
  readonly openError = signal<string | null>(null);
  readonly showOpen = signal(false);
  readonly customerResults = signal<BillCustomerOption[]>([]);
  readonly selectedCustomer = signal<BillCustomerOption | null>(null);
  readonly isSearching = signal(false);

  readonly canOpen = computed(() => {
    const options = this.options();
    return !!options && (options.ownStaffProfileId !== null || options.canManage);
  });

  readonly openForm = this.formBuilder.nonNullable.group({
    search: [''],
    walkInName: ['', [trimmedMinLength(2), Validators.maxLength(120)]],
    staffProfileId: [''],
  });

  ngOnInit(): void {
    void this.loadOptions();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  selectTab(tab: BillTab): void {
    this.navigate({ tab: tab === 'pending' ? null : tab, page: 1, q: null });
  }

  onSearch(text: string): void {
    this.navigate({ q: text.trim(), page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  /** «No hay cuentas …» for each list tab. */
  emptyLabel(): string {
    const labels: Record<string, string> = {
      Closed: 'por aprobar',
      Unapproved: 'en corrección',
      Approved: 'aprobadas',
      Voided: 'anuladas',
    };
    return labels[this.tab()] ?? '';
  }

  formatDateTime(value: string): string {
    return DATE_TIME.format(new Date(value));
  }

  openNewBill(): void {
    this.openKey = newIdempotencyKey();
    this.openError.set(null);
    this.customerResults.set([]);
    this.selectedCustomer.set(null);
    this.openForm.reset({ search: '', walkInName: '', staffProfileId: this.options()?.ownStaffProfileId ?? '' });
    this.showOpen.set(true);
  }

  closeOpenModal(): void {
    if (!this.isOpening()) {
      this.showOpen.set(false);
    }
  }

  async searchCustomers(): Promise<void> {
    const term = this.openForm.controls.search.value.trim();
    if (term.length < 2) {
      this.openError.set('Escribe al menos 2 letras o números para buscar.');
      return;
    }
    this.isSearching.set(true);
    this.openError.set(null);
    try {
      const results = await firstValueFrom(this.api.searchCustomers(term));
      this.customerResults.set(results);
      if (!results.length) {
        this.openError.set('No encontramos clientes con esa búsqueda. Puedes abrirla como cliente ocasional.');
      }
    } catch (error) {
      this.openError.set(getApiErrorMessage(error));
    } finally {
      this.isSearching.set(false);
    }
  }

  chooseCustomer(customer: BillCustomerOption | null): void {
    this.selectedCustomer.set(customer);
  }

  @SingleFlight()
  async openBill(): Promise<void> {
    const customer = this.selectedCustomer();
    const walkIn = this.openForm.controls.walkInName.value.trim();
    if (!customer && walkIn.length < 2) {
      this.openError.set('Elige un cliente o escribe el nombre del cliente ocasional.');
      return;
    }
    const staffProfileId = this.openForm.controls.staffProfileId.value || null;
    await this.open({
      idempotencyKey: this.openKey,
      customerId: customer?.id ?? null,
      customerName: customer ? null : walkIn,
      staffProfileId,
    });
  }

  @SingleFlight()
  async openForAppointment(appointmentId: string): Promise<void> {
    this.openKey = newIdempotencyKey();
    await this.open({ idempotencyKey: this.openKey, appointmentId });
  }

  private async open(request: Parameters<BillsApiService['open']>[0]): Promise<void> {
    this.isOpening.set(true);
    this.openError.set(null);
    this.errorMessage.set(null);
    try {
      const bill = await firstValueFrom(this.api.open(request));
      this.isOpening.set(false);
      this.showOpen.set(false);
      await this.router.navigate(['/bills', bill.id]);
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (this.showOpen()) {
        this.openError.set(message);
      } else {
        this.errorMessage.set(message);
      }
      this.isOpening.set(false);
    }
  }

  private async loadOptions(): Promise<void> {
    try {
      this.options.set(await firstValueFrom(this.api.options()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    }
  }

  private applyQuery(params: ParamMap): void {
    this.tab.set(readOptionParam(params, 'tab', BILL_TABS) || 'pending');
    this.query.set(readTextParam(params, 'q'));
    this.page.set(readPageParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(patch), queryParamsHandling: 'merge' });
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const tab = this.tab();
      if (tab === 'pending') {
        const pending = await firstValueFrom(this.api.pending());
        if (sequence === this.loadSequence) {
          this.pending.set(pending);
        }
      } else {
        const page = await firstValueFrom(
          this.api.list({ status: tab as BillStatus, q: this.query() || null, page: this.page(), pageSize: DEFAULT_PAGE_SIZE }),
        );
        if (sequence === this.loadSequence) {
          this.bills.set(page.items);
          this.totalCount.set(page.totalCount);
        }
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
