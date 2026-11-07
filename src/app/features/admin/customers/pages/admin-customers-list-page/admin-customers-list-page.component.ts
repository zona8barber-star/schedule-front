import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CustomerDetailView, CustomerListItem } from '../../../../../core/models/customer.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { AdminCustomersApiService } from '../../../../../core/services/admin-customers-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readPageParam,
  readPageSizeParam,
  readTextParam,
  toQueryParams,
} from '../../../../../core/utils/list-query.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { AdminCustomerFormModalComponent } from '../../components/admin-customer-form-modal/admin-customer-form-modal.component';
import { AdminCustomerFromAccountModalComponent } from '../../components/admin-customer-from-account-modal/admin-customer-from-account-modal.component';

@Component({
  selector: 'app-admin-customers-list-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    ApiFeedbackComponent,
    PageStateComponent,
    PaginatorComponent,
    AdminCustomerFormModalComponent,
    AdminCustomerFromAccountModalComponent,
  ],
  templateUrl: './admin-customers-list-page.component.html',
  styleUrl: './admin-customers-list-page.component.scss',
})
export class AdminCustomersListPageComponent implements OnInit {
  private readonly adminCustomersApiService = inject(AdminCustomersApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly customers = signal<CustomerListItem[]>([]);
  readonly query = signal('');
  /** The search applied to the list (the URL); `query` is what the input currently holds. */
  readonly appliedQuery = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);
  readonly openModal = signal<'create' | 'fromAccount' | null>(null);

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.appliedQuery.set(readTextParam(params, 'q'));
      this.query.set(this.appliedQuery());
      this.page.set(readPageParam(params));
      this.pageSize.set(readPageSizeParam(params));
      void this.load();
    });
  }

  search(): void {
    this.navigate({ q: this.query().trim(), page: 1 });
  }

  clearSearch(): void {
    this.query.set('');
    this.navigate({ q: '', page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  openCreate(): void {
    this.openModal.set('create');
  }

  openFromAccount(): void {
    this.openModal.set('fromAccount');
  }

  closeModal(): void {
    this.openModal.set(null);
  }

  /** Also used when the account was linked to an existing profile instead of creating a new one. */
  onCreated(customer: CustomerDetailView): void {
    this.openModal.set(null);
    void this.router.navigate(['/admin/customers', customer.id]);
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
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(
        this.adminCustomersApiService.search(this.appliedQuery(), { page: this.page(), pageSize: this.pageSize() }),
      );
      if (sequence === this.loadSequence) {
        this.customers.set(result.items);
        this.totalCount.set(result.totalCount);
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
