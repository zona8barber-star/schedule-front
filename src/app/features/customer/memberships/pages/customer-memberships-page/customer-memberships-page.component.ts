import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { MembershipDisplayStatus } from '../../../../../core/models/membership.models';
import { MyMembershipSummaryView } from '../../../../../core/models/my-membership.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { CustomerMembershipsApiService } from '../../../../../core/services/customer-memberships-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readDateParam,
  readOptionParam,
  readPageParam,
  toQueryParams,
} from '../../../../../core/utils/list-query.utils';
import {
  historyRangeError,
  rangeWithFrom,
  rangeWithTo,
  resolveOptionalRange,
} from '../../../../../core/utils/history-range.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { MY_MEMBERSHIP_STATUS_LABELS, balanceAvailability } from '../../my-membership-labels';

const STATUSES: readonly MembershipDisplayStatus[] = ['PendingActivation', 'Scheduled', 'Active', 'Expired', 'Annulled'];

/**
 * "Mis membresías": read-only list of the memberships of the signed-in customer's linked profile, paginated on the
 * server with status and sale date filters kept in the URL (ADR-0016 B7).
 */
@Component({
  selector: 'app-customer-memberships-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent, PaginatorComponent],
  templateUrl: './customer-memberships-page.component.html',
  styleUrl: '../../my-memberships.scss',
})
export class CustomerMembershipsPageComponent implements OnInit {
  private readonly membershipsApi = inject(CustomerMembershipsApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly statusLabels = MY_MEMBERSHIP_STATUS_LABELS;
  readonly statuses = STATUSES;
  readonly memberships = signal<MyMembershipSummaryView[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly status = signal<MembershipDisplayStatus | ''>('');
  readonly soldFrom = signal('');
  readonly soldTo = signal('');
  /** Memberships are current items: no default dates (an old active one is never hidden); a range covers at most 30 days. */
  readonly soldRange = computed(() => resolveOptionalRange(this.soldFrom(), this.soldTo()));
  readonly rangeError = computed(() => {
    const range = this.soldRange();
    return range ? historyRangeError(range.from, range.to) : null;
  });
  readonly page = signal(1);
  readonly pageSize = DEFAULT_PAGE_SIZE;
  readonly hasFilters = computed(() => !!(this.status() || this.soldFrom() || this.soldTo()));

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  availability(membership: MyMembershipSummaryView) {
    return balanceAvailability(membership.displayStatus, membership.startsOn, membership.endsOn);
  }

  onFilterChange(patch: Record<string, QueryValue>): void {
    this.navigate({ ...patch, page: 1 });
  }

  onSoldFromChange(value: string): void {
    const range = rangeWithFrom(value, this.soldRange() ?? { from: '', to: '' });
    this.navigate({ soldFrom: range.from, soldTo: range.to, page: 1 });
  }

  onSoldToChange(value: string): void {
    const range = rangeWithTo(value, this.soldRange() ?? { from: '', to: '' });
    this.navigate({ soldFrom: range.from, soldTo: range.to, page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  private applyQuery(params: ParamMap): void {
    this.status.set(readOptionParam(params, 'status', STATUSES));
    this.soldFrom.set(readDateParam(params, 'soldFrom'));
    this.soldTo.set(readDateParam(params, 'soldTo'));
    this.page.set(readPageParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(patch), queryParamsHandling: 'merge' });
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.errorMessage.set(this.rangeError());
    if (this.rangeError()) {
      // The API would reject it too (422); explain it instead of asking.
      this.memberships.set([]);
      this.totalCount.set(0);
      this.isLoading.set(false);
      return;
    }
    this.isLoading.set(true);
    try {
      const range = this.soldRange();
      const result = await firstValueFrom(
        this.membershipsApi.list({
          status: this.status() || null,
          soldFrom: range?.from ?? null,
          soldTo: range?.to ?? null,
          page: this.page(),
          pageSize: this.pageSize,
        }),
      );
      if (sequence === this.loadSequence) {
        this.memberships.set(result.items);
        this.totalCount.set(result.totalCount);
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.errorMessage.set(getApiErrorMessage(error));
        this.memberships.set([]);
        this.totalCount.set(0);
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
