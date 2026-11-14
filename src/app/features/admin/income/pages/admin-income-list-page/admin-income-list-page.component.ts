import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { IncomeEntryView, IncomeKind } from '../../../../../core/models/income.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { GeneralServiceView } from '../../../../../core/models/service-catalog.models';
import { StaffListItem } from '../../../../../core/models/staff.models';
import { AdminIncomeApiService } from '../../../../../core/services/admin-income-api.service';
import { AdminServiceCatalogApiService } from '../../../../../core/services/admin-service-catalog-api.service';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { formatCop } from '../../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readDateParam,
  readOptionParam,
  readPageParam,
  readPageSizeParam,
  readTextParam,
  toQueryParams,
} from '../../../../../core/utils/list-query.utils';
import {
  HISTORY_RANGE_HINT,
  defaultHistoryRange,
  historyRangeError,
  rangeWithFrom,
  rangeWithTo,
  resolveHistoryRange,
} from '../../../../../core/utils/history-range.utils';
import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { AdminIncomeFormModalComponent } from '../../components/admin-income-form-modal/admin-income-form-modal.component';

const INCOME_KINDS: readonly IncomeKind[] = ['Service', 'MembershipSale'];

/**
 * Income history (ADR-0016 B7): a date range (the last 30 days by default, at most 30 days per query, any period),
 * professional, kind and
 * general service, paginated on the server. The filters live in the URL; the total covers every matching entry.
 */
import { SingleFlight } from '../../../../../core/utils/single-flight';

@Component({
  selector: 'app-admin-income-list-page',
  imports: [FormsModule, DecimalPipe, ApiFeedbackComponent, AdminIncomeFormModalComponent, PaginatorComponent],
  templateUrl: './admin-income-list-page.component.html',
  styleUrl: './admin-income-list-page.component.scss',
})
export class AdminIncomeListPageComponent implements OnInit {
  private readonly incomeApi = inject(AdminIncomeApiService);
  private readonly staffApi = inject(AdminStaffApiService);
  private readonly catalogApi = inject(AdminServiceCatalogApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly today = bogotaToday();
  readonly rangeHint = HISTORY_RANGE_HINT;
  readonly fromDate = signal(defaultHistoryRange(this.today).from);
  readonly toDate = signal(this.today);
  /** Set when the range in the URL cannot be queried (reversed or longer than 30 days); nothing is requested then. */
  readonly rangeError = signal<string | null>(null);
  readonly selectedStaffId = signal<string>('');
  readonly selectedKind = signal<IncomeKind | ''>('');
  readonly selectedGeneralServiceId = signal<string>('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly staff = signal<StaffListItem[]>([]);
  readonly generalServices = signal<GeneralServiceView[]>([]);
  readonly entries = signal<IncomeEntryView[]>([]);
  readonly totalCount = signal(0);
  /** Total of every entry matching the filters (not only this page). */
  readonly total = signal(0);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isModalOpen = signal(false);
  readonly editingEntry = signal<IncomeEntryView | null>(null);
  readonly busyId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.staff.set(await firstValueFrom(this.staffApi.list()));
    } catch {
      // A staff-load failure shouldn't block the income list; the filter just stays empty.
    }
    try {
      this.generalServices.set(await firstValueFrom(this.catalogApi.listGeneralServices()));
    } catch {
      // Same for the general service filter.
    }

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  onFromChange(date: string): void {
    // Keeps a valid range (at most 30 days, never after today): the end follows the start when needed.
    this.navigate({ ...rangeWithFrom(date, this.currentRange(), this.today), page: 1 });
  }

  onToChange(date: string): void {
    this.navigate({ ...rangeWithTo(date, this.currentRange()), page: 1 });
  }

  private currentRange() {
    return { from: this.fromDate(), to: this.toDate() };
  }

  onStaffChange(staffId: string): void {
    this.navigate({ staffProfileId: staffId, page: 1 });
  }

  onKindChange(kind: IncomeKind | ''): void {
    this.navigate({ kind, page: 1 });
  }

  onGeneralServiceChange(generalServiceId: string): void {
    this.navigate({ generalServiceId, page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  openCreate(): void {
    this.editingEntry.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(entry: IncomeEntryView): void {
    this.editingEntry.set(entry);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingEntry.set(null);
  }

  onSaved(): void {
    this.closeModal();
    void this.load();
  }

  @SingleFlight()
  async deleteEntry(entry: IncomeEntryView): Promise<void> {
    // SONDA BUG-083: a membership sale has no service name; amounts in pesos with thousands separator (C2 format).
    const concept = entry.kind === 'MembershipSale' ? 'Venta de membresía' : (entry.serviceName ?? 'Ingreso');
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar ingreso?',
      message: `Se eliminará el ingreso de "${concept}" (${formatCop(entry.amount)}).`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(entry.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.incomeApi.remove(entry.id));
      // Reload so the page, the count and the total stay consistent with the server.
      await this.load();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        // SONDA BUG-084: already deleted elsewhere (another tab or person): say so and refresh the list.
        await this.load();
        this.errorMessage.set('Este ingreso ya no existe: se eliminó en otra pestaña o por otra persona. La lista se actualizó.');
      } else {
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      this.busyId.set(null);
    }
  }

  private applyQuery(params: ParamMap): void {
    const range = resolveHistoryRange(readDateParam(params, 'from'), readDateParam(params, 'to'), this.today);
    this.fromDate.set(range.from);
    this.toDate.set(range.to);
    this.selectedStaffId.set(readTextParam(params, 'staffProfileId'));
    this.selectedKind.set(readOptionParam(params, 'kind', INCOME_KINDS));
    this.selectedGeneralServiceId.set(readTextParam(params, 'generalServiceId'));
    this.page.set(readPageParam(params));
    this.pageSize.set(readPageSizeParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(patch),
      queryParamsHandling: 'merge',
    });
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.errorMessage.set(null);
    this.rangeError.set(historyRangeError(this.fromDate(), this.toDate()));
    if (this.rangeError()) {
      // The API would reject it too (422); show why instead of a generic error.
      this.entries.set([]);
      this.totalCount.set(0);
      this.total.set(0);
      this.isLoading.set(false);
      return;
    }
    this.isLoading.set(true);
    try {
      const result = await firstValueFrom(
        this.incomeApi.list({
          from: this.fromDate(),
          to: this.toDate(),
          staffProfileId: this.selectedStaffId() || null,
          kind: this.selectedKind() || null,
          generalServiceId: this.selectedGeneralServiceId() || null,
          page: this.page(),
          pageSize: this.pageSize(),
        }),
      );
      if (sequence !== this.loadSequence) {
        return;
      }
      this.entries.set(result.items);
      this.totalCount.set(result.totalCount);
      this.total.set(result.totalAmount);
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
