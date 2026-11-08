import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CustomerClaimStatus, CustomerClaimView } from '../../../../../core/models/customer-claim.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { CustomerClaimsApiService } from '../../../../../core/services/customer-claims-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { QueryValue, readOptionParam, readPageParam, toQueryParams } from '../../../../../core/utils/list-query.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { AdminCustomerClaimReviewModalComponent } from '../../components/admin-customer-claim-review-modal/admin-customer-claim-review-modal.component';

const TABS: { status: CustomerClaimStatus; label: string }[] = [
  { status: 'Pending', label: 'Pendientes' },
  { status: 'Approved', label: 'Aprobadas' },
  { status: 'Rejected', label: 'Rechazadas' },
];
const STATUSES: readonly CustomerClaimStatus[] = TABS.map((tab) => tab.status);

/**
 * Customer claims inbox, paginated on the server (ADR-0016 B7). The tab (`status`, Pending by default) and the page
 * live in the URL like the other lists, so navigating, going back and forth and reloading keep them. An unknown
 * status or a malformed page is corrected by `customerClaimsQueryGuard` before the page is activated; a page past the
 * end is moved to the last page once the total is known.
 */
@Component({
  selector: 'app-admin-customer-claims-page',
  imports: [DatePipe, ApiFeedbackComponent, PageStateComponent, PaginatorComponent, AdminCustomerClaimReviewModalComponent],
  templateUrl: './admin-customer-claims-page.component.html',
  styleUrl: '../../../service-records/pages/admin-service-records-page/admin-service-records-page.component.scss',
})
export class AdminCustomerClaimsPageComponent implements OnInit {
  private readonly api = inject(CustomerClaimsApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly tabs = TABS;
  readonly status = signal<CustomerClaimStatus>('Pending');
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly claims = signal<CustomerClaimView[]>([]);
  /** Paginated on the server: pending ones oldest first and never filtered by date, so none is hidden. */
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly pageSize = DEFAULT_PAGE_SIZE;
  readonly reviewing = signal<CustomerClaimView | null>(null);

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  /** A new tab always starts on its first page. */
  selectTab(status: CustomerClaimStatus): void {
    this.successMessage.set(null);
    this.navigate({ status: status === 'Pending' ? null : status, page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  onReviewed(result: CustomerClaimView): void {
    // The decided claim leaves this tab: reload so the page and the count stay right.
    void this.load();
    this.successMessage.set(
      result.status === 'Approved'
        ? `Cuenta de ${result.accountFullName} vinculada al perfil "${result.approvedCustomerName}".`
        : `Solicitud de ${result.accountFullName} rechazada.`,
    );
    this.reviewing.set(null);
  }

  async onStale(): Promise<void> {
    this.reviewing.set(null);
    await this.load();
  }

  /** Reads the tab and the page from the URL (kept canonical by `customerClaimsQueryGuard`; unknown values fall back). */
  private applyQuery(params: ParamMap): void {
    this.status.set(readOptionParam(params, 'status', STATUSES) || 'Pending');
    this.page.set(readPageParam(params));
  }

  private navigate(patch: Record<string, QueryValue>, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(patch),
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(this.api.list(this.status(), { page: this.page(), pageSize: this.pageSize }));
      if (sequence !== this.loadSequence) {
        return;
      }
      // A page past the end (deciding the last claim of the last page, or an old link): go to the last page.
      if (!result.items.length && result.totalCount > 0 && this.page() > 1) {
        this.navigate({ page: Math.ceil(result.totalCount / this.pageSize) }, true);
        return;
      }
      this.claims.set(result.items);
      this.totalCount.set(result.totalCount);
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.claims.set([]);
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
