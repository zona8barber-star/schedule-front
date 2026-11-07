import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import {
  SERVICE_RECORD_OPERATION_LABELS,
  ServiceRecordOptionsView,
  ServiceRecordStatus,
  ServiceRecordView,
} from '../../../../../core/models/service-record.models';
import { ServiceRecordsApiService } from '../../../../../core/services/service-records-api.service';
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
  HistoryRange,
  historyRangeError,
  rangeWithFrom,
  rangeWithTo,
  resolveHistoryRange,
  resolveOptionalRange,
} from '../../../../../core/utils/history-range.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { AdminServiceRecordReviewModalComponent } from '../../components/admin-service-record-review-modal/admin-service-record-review-modal.component';

const TABS: { status: ServiceRecordStatus; label: string }[] = [
  { status: 'Pending', label: 'Pendientes' },
  { status: 'Approved', label: 'Confirmados' },
  { status: 'Rejected', label: 'Rechazados' },
];

const STATUSES: readonly ServiceRecordStatus[] = TABS.map((tab) => tab.status);

/**
 * Services performed (ADR-0016 B7): one tab per status, with date range, professional and general service filters,
 * paginated on the server. The tab and the filters live in the URL.
 */
@Component({
  selector: 'app-admin-service-records-page',
  imports: [
    DatePipe,
    DecimalPipe,
    ApiFeedbackComponent,
    PageStateComponent,
    PaginatorComponent,
    AdminServiceRecordReviewModalComponent,
  ],
  templateUrl: './admin-service-records-page.component.html',
  styleUrl: './admin-service-records-page.component.scss',
})
export class AdminServiceRecordsPageComponent implements OnInit {
  private readonly api = inject(ServiceRecordsApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly tabs = TABS;
  readonly operationLabels = SERVICE_RECORD_OPERATION_LABELS;

  readonly status = signal<ServiceRecordStatus>('Pending');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly rangeHint = HISTORY_RANGE_HINT;
  /**
   * Pending is the review queue: no default dates, so an old pending record is never hidden. Confirmed and rejected
   * are history: the last 30 days by default. Either way a range covers at most 30 days.
   */
  readonly range = computed<HistoryRange | null>(() =>
    this.status() === 'Pending'
      ? resolveOptionalRange(this.fromDate(), this.toDate())
      : resolveHistoryRange(this.fromDate(), this.toDate()),
  );
  readonly rangeError = computed(() => {
    const range = this.range();
    return range ? historyRangeError(range.from, range.to) : null;
  });
  readonly staffProfileId = signal('');
  readonly generalServiceId = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly records = signal<ServiceRecordView[]>([]);
  readonly options = signal<ServiceRecordOptionsView | null>(null);
  readonly reviewing = signal<ServiceRecordView | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.options.set(await firstValueFrom(this.api.options()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    }

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  selectTab(status: ServiceRecordStatus): void {
    this.successMessage.set(null);
    this.navigate({ status: status === 'Pending' ? null : status, page: 1 });
  }

  onFilterChange(patch: Record<string, QueryValue>): void {
    this.navigate({ ...patch, page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  onFromChange(value: string): void {
    this.navigate({ ...rangeWithFrom(value, this.range() ?? { from: '', to: '' }), page: 1 });
  }

  onToChange(value: string): void {
    this.navigate({ ...rangeWithTo(value, this.range() ?? { from: '', to: '' }), page: 1 });
  }

  clearDates(): void {
    this.navigate({ from: null, to: null, page: 1 });
  }

  openReview(record: ServiceRecordView): void {
    this.reviewing.set(record);
  }

  closeReview(): void {
    this.reviewing.set(null);
  }

  onReviewed(result: ServiceRecordView): void {
    this.successMessage.set(
      result.status === 'Approved'
        ? `"${result.approval?.serviceName}" confirmado como ${this.operationLabels[result.approval!.operationType].toLowerCase()}.`
        : `Registro de "${result.serviceName}" rechazado.`,
    );
    this.closeReview();
    // The reviewed record leaves this tab: reload so the page and the count stay right.
    void this.load();
  }

  async onStale(): Promise<void> {
    this.closeReview();
    await this.load();
  }

  private applyQuery(params: ParamMap): void {
    this.status.set(readOptionParam(params, 'status', STATUSES) || 'Pending');
    this.fromDate.set(readDateParam(params, 'from'));
    this.toDate.set(readDateParam(params, 'to'));
    this.staffProfileId.set(readTextParam(params, 'staffProfileId'));
    this.generalServiceId.set(readTextParam(params, 'generalServiceId'));
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
    if (this.rangeError()) {
      // The API would reject it too (422); the message next to the dates explains why.
      this.records.set([]);
      this.totalCount.set(0);
      this.isLoading.set(false);
      return;
    }
    this.isLoading.set(true);
    try {
      const range = this.range();
      const result = await firstValueFrom(
        this.api.list({
          status: this.status(),
          from: range?.from ?? null,
          to: range?.to ?? null,
          staffProfileId: this.staffProfileId() || null,
          generalServiceId: this.generalServiceId() || null,
          page: this.page(),
          pageSize: this.pageSize(),
        }),
      );
      if (sequence === this.loadSequence) {
        this.records.set(result.items);
        this.totalCount.set(result.totalCount);
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.records.set([]);
        this.totalCount.set(0);
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
