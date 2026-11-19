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
import { PERMISSION_CODES, ROLE_NAMES } from '../../../../core/models/auth.models';
import { newIdempotencyKey } from '../../../../core/models/loyalty-redemption.models';
import { DEFAULT_PAGE_SIZE } from '../../../../core/models/paged-result.models';
import { AuthService } from '../../../../core/services/auth.service';
import { BillsApiService } from '../../../../core/services/bills-api.service';
import { formatCop } from '../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.utils';
import { bogotaDateTimeFormat } from '../../../../core/utils/bogota-date.utils';
import { trimmedMinLength } from '../../../../core/utils/form-validators';
import {
  historyRangeError,
  rangeWithFrom,
  rangeWithTo,
  resolveOptionalRange,
} from '../../../../core/utils/history-range.utils';
import {
  QueryValue,
  readDateParam,
  readOptionParam,
  readPageParam,
  readTextParam,
  toQueryParams,
} from '../../../../core/utils/list-query.utils';
import { SingleFlight } from '../../../../core/utils/single-flight';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { FormA11yDirective } from '../../../../shared/directives/form-a11y.directive';
import { ModalDialogDirective } from '../../../../shared/directives/modal-dialog.directive';

export const BILL_TABS = ['pending', 'Closed', 'Unapproved', 'Approved', 'Voided', 'all'] as const;
export type BillTab = (typeof BILL_TABS)[number];

const DATE_TIME = bogotaDateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * «Cuentas» (ADR-0020): the bills to close (open ones, overdue after 7 days, and completed appointments without a bill,
 * BUG-092), the approval tray and the history. A professional sees their own bills; whoever manages, approves or voids
 * bills sees all of them. Stage 5: the lists filter by service dates, professional, payment method and customer (with
 * the profiles merged into it). The tab, the filters and the page live in the URL.
 */
@Component({
  selector: 'app-bills-page',
  imports: [FormA11yDirective, ModalDialogDirective, ReactiveFormsModule, RouterLink, ApiFeedbackComponent, PaginatorComponent, LoadErrorComponent],
  templateUrl: './bills-page.component.html',
  styleUrls: ['../../../admin/service-catalog/catalog-page.scss', '../../bills.scss'],
})
export class BillsPageComponent implements OnInit {
  private readonly api = inject(BillsApiService);
  private readonly authService = inject(AuthService);
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
  /** SONDA BUG-135: the list could not be loaded (API down, 500): the common error state, never just the tabs. */
  readonly loadError = signal<unknown>(null);
  readonly options = signal<BillOptionsView | null>(null);
  readonly tab = signal<BillTab>('pending');
  readonly query = signal('');
  readonly page = signal(1);
  readonly totalCount = signal(0);
  readonly pending = signal<BillPendingView | null>(null);
  readonly bills = signal<BillSummaryView[]>([]);
  readonly from = signal('');
  readonly to = signal('');
  readonly staffProfileId = signal('');
  readonly paymentMethodId = signal('');
  readonly customerId = signal('');
  /** No dates by default (an old bill being corrected is never hidden); a range covers at most 30 days. */
  readonly range = computed(() => resolveOptionalRange(this.from(), this.to()));
  readonly rangeError = computed(() => {
    const range = this.range();
    return range ? historyRangeError(range.from, range.to) : null;
  });
  readonly hasFilters = computed(
    () => !!(this.query() || this.from() || this.to() || this.staffProfileId() || this.paymentMethodId() || this.customerId()),
  );
  /** Whoever sees every bill can filter by professional; a professional only sees their own. */
  readonly canFilterByStaff = computed(() => {
    const options = this.options();
    return !!options && (options.canManage || options.canApprove || options.canVoid);
  });
  /** ADR-0020 stage 6: the services registered before the bills, read only, for whoever reviewed them. */
  readonly canSeeOldRecords = this.authService.hasPermission(PERMISSION_CODES.serviceRecordsApprove);

  readonly isOpening = signal(false);
  readonly openError = signal<string | null>(null);
  readonly showOpen = signal(false);
  readonly customerResults = signal<BillCustomerOption[]>([]);
  readonly selectedCustomer = signal<BillCustomerOption | null>(null);
  readonly isSearching = signal(false);

  /** ADR-0021 L15 (SONDA BUG-157): only the Admin and whoever opens bills (bills.open) search customers. */
  readonly canSearchCustomers =
    this.authService.hasRole(ROLE_NAMES.admin) || this.authService.hasPermission(PERMISSION_CODES.billsOpen);

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

  onFilterChange(patch: Record<string, QueryValue>): void {
    this.navigate({ ...patch, page: 1 });
  }

  onFromChange(value: string): void {
    const range = rangeWithFrom(value, this.range() ?? { from: '', to: '' });
    this.navigate({ from: range.from, to: range.to, page: 1 });
  }

  onToChange(value: string): void {
    const range = rangeWithTo(value, this.range() ?? { from: '', to: '' });
    this.navigate({ from: range.from, to: range.to, page: 1 });
  }

  clearFilters(): void {
    this.navigate({ q: null, from: null, to: null, staffProfileId: null, paymentMethodId: null, customerId: null, page: 1 });
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
      all: '',
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
    // SONDA BUG-157: a name from 3 letters; an email or a phone only in full (the API applies the same rule).
    if (term.length < 3) {
      this.openError.set('Escribe al menos 3 letras del nombre, o el correo o el celular completos.');
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
    this.from.set(readDateParam(params, 'from'));
    this.to.set(readDateParam(params, 'to'));
    this.staffProfileId.set(readTextParam(params, 'staffProfileId'));
    this.paymentMethodId.set(readTextParam(params, 'paymentMethodId'));
    this.customerId.set(readTextParam(params, 'customerId'));
    this.page.set(readPageParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(patch), queryParamsHandling: 'merge' });
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.loadError.set(null);
    try {
      const tab = this.tab();
      if (tab === 'pending') {
        const pending = await firstValueFrom(this.api.pending(this.page(), DEFAULT_PAGE_SIZE));
        if (sequence === this.loadSequence) {
          this.pending.set(pending);
          this.totalCount.set(pending.openBillsTotalCount ?? pending.openBills.length);
        }
      } else if (this.rangeError()) {
        // The API would reject it too (422); explain it instead of asking.
        this.errorMessage.set(this.rangeError());
        this.bills.set([]);
        this.totalCount.set(0);
      } else {
        const range = this.range();
        const page = await firstValueFrom(
          this.api.list({
            status: tab === 'all' ? null : (tab as BillStatus),
            q: this.query() || null,
            from: range?.from ?? null,
            to: range?.to ?? null,
            staffProfileId: this.staffProfileId() || null,
            paymentMethodId: this.paymentMethodId() || null,
            customerId: this.customerId() || null,
            page: this.page(),
            pageSize: DEFAULT_PAGE_SIZE,
          }),
        );
        if (sequence === this.loadSequence) {
          this.bills.set(page.items);
          this.totalCount.set(page.totalCount);
        }
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.loadError.set(error);
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }

  retryLoad(): void {
    void this.load();
  }
}
