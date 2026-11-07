import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  CustomerDetailView,
  CustomerEventType,
  CustomerEventView,
} from '../../../../../core/models/customer.models';
import {
  CustomerMembershipDetailView,
  CustomerMembershipSummaryView,
  MembershipDisplayStatus,
} from '../../../../../core/models/membership.models';
import { MembershipPlanView } from '../../../../../core/models/membership-plan.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { AdminCustomersApiService } from '../../../../../core/services/admin-customers-api.service';
import { AdminMembershipPlansApiService } from '../../../../../core/services/admin-membership-plans-api.service';
import { AdminMembershipsApiService } from '../../../../../core/services/admin-memberships-api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readDateParam,
  readOptionParam,
  readPageParam,
  readTextParam,
} from '../../../../../core/utils/list-query.utils';
import { historyRangeError, resolveOptionalRange } from '../../../../../core/utils/history-range.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { AdminCustomerFormModalComponent } from '../../components/admin-customer-form-modal/admin-customer-form-modal.component';
import { AdminCustomerLoyaltyPanelComponent } from '../../components/admin-customer-loyalty-panel/admin-customer-loyalty-panel.component';
import { AdminCustomerLinkAccountModalComponent } from '../../components/admin-customer-link-account-modal/admin-customer-link-account-modal.component';
import { AdminCustomerMergeModalComponent } from '../../components/admin-customer-merge-modal/admin-customer-merge-modal.component';
import { AdminCustomerUnlinkAccountModalComponent } from '../../components/admin-customer-unlink-account-modal/admin-customer-unlink-account-modal.component';
import { AdminMembershipSellModalComponent } from '../../../memberships/components/admin-membership-sell-modal/admin-membership-sell-modal.component';
import { MEMBERSHIP_STATUS_LABELS } from '../../../memberships/membership-labels';

const MEMBERSHIP_STATUSES: readonly MembershipDisplayStatus[] = ['PendingActivation', 'Scheduled', 'Active', 'Expired', 'Annulled'];

type CustomerModal = 'edit' | 'link' | 'unlink' | 'merge' | 'sell';

const EVENT_LABELS: Record<CustomerEventType, string> = {
  Created: 'Perfil creado',
  AccountLinked: 'Cuenta vinculada',
  AccountUnlinked: 'Cuenta desvinculada',
  MergedFrom: 'Perfil duplicado fusionado aquí',
  MergedInto: 'Fusionado en otro perfil',
};

@Component({
  selector: 'app-admin-customer-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    ApiFeedbackComponent,
    PageStateComponent,
    AdminCustomerFormModalComponent,
    AdminCustomerLinkAccountModalComponent,
    AdminCustomerUnlinkAccountModalComponent,
    AdminCustomerMergeModalComponent,
    AdminCustomerLoyaltyPanelComponent,
    AdminMembershipSellModalComponent,
    DecimalPipe,
    PaginatorComponent,
  ],
  templateUrl: './admin-customer-detail-page.component.html',
  styleUrl: './admin-customer-detail-page.component.scss',
})
export class AdminCustomerDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly adminCustomersApiService = inject(AdminCustomersApiService);
  private readonly membershipsApi = inject(AdminMembershipsApiService);
  private readonly plansApi = inject(AdminMembershipPlansApiService);
  private membershipsSequence = 0;
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly membershipStatusLabels = MEMBERSHIP_STATUS_LABELS;
  readonly memberships = signal<CustomerMembershipSummaryView[]>([]);
  readonly membershipsError = signal<string | null>(null);
  // Membership list filters (ADR-0016 B7), kept in the URL with a "membership" prefix so they never clash with the
  // movement filters of the loyalty panel on the same page.
  readonly membershipStatuses = MEMBERSHIP_STATUSES;
  readonly membershipStatus = signal<MembershipDisplayStatus | ''>('');
  readonly membershipPlanId = signal('');
  readonly membershipSoldFrom = signal('');
  readonly membershipSoldTo = signal('');
  readonly membershipsPage = signal(1);
  readonly membershipsPageSize = DEFAULT_PAGE_SIZE;
  readonly membershipsTotal = signal(0);
  readonly plans = signal<MembershipPlanView[]>([]);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly customer = signal<CustomerDetailView | null>(null);
  readonly openModal = signal<CustomerModal | null>(null);
  private readonly loyaltyPanel = viewChild(AdminCustomerLoyaltyPanelComponent);

  ngOnInit(): void {
    // Subscribing (not the snapshot) so following the "merged into" link reloads this same page.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const customerId = params.get('customerId');
      if (customerId) {
        void this.load(customerId);
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyMembershipQuery(params);
      const current = this.customer();
      if (current && !this.isLoading()) {
        void this.loadMemberships(current.id);
      }
    });

    void firstValueFrom(this.plansApi.list())
      .then((plans) => this.plans.set(plans))
      .catch(() => this.plans.set([]));
  }

  onMembershipFilterChange(patch: Record<string, QueryValue>): void {
    this.navigateMemberships({ ...patch, membershipPage: null });
  }

  onMembershipsPageChange(page: number): void {
    this.navigateMemberships({ membershipPage: page > 1 ? page : null });
  }

  open(modal: CustomerModal): void {
    this.openModal.set(modal);
  }

  closeModal(): void {
    this.openModal.set(null);
  }

  onUpdated(customer: CustomerDetailView, message: string): void {
    this.customer.set(customer);
    this.openModal.set(null);
    this.toastService.success(message);
    // A merge brings the duplicate's memberships and usable points over to this profile.
    void this.loadMemberships(customer.id);
    void this.loyaltyPanel()?.load();
  }

  onSold(membership: CustomerMembershipDetailView): void {
    this.openModal.set(null);
    this.toastService.success('Membresía vendida.');
    void this.router.navigate(['/admin/memberships', membership.id]);
  }

  eventLabel(customerEvent: CustomerEventView): string {
    return EVENT_LABELS[customerEvent.type] ?? customerEvent.type;
  }

  /** For a merged profile: the account it handed over to the surviving profile, if any. */
  transferredAccountEmail(customer: CustomerDetailView): string | null {
    return customer.events.find((customerEvent) => customerEvent.type === 'MergedInto')?.userEmail ?? null;
  }

  private async load(customerId: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.openModal.set(null);
    try {
      this.customer.set(await firstValueFrom(this.adminCustomersApiService.getById(customerId)));
    } catch (error) {
      this.customer.set(null);
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }

    if (this.customer()) {
      await this.loadMemberships(customerId);
    }
  }

  /** Loaded separately so a failure here never hides the customer's own data. */
  private async loadMemberships(customerId: string): Promise<void> {
    const sequence = ++this.membershipsSequence;
    // Current items: no default dates; a sale range (from the URL) covers at most 30 days, like the API requires.
    const soldRange = resolveOptionalRange(this.membershipSoldFrom(), this.membershipSoldTo());
    this.membershipsError.set(soldRange ? historyRangeError(soldRange.from, soldRange.to) : null);
    if (this.membershipsError()) {
      this.memberships.set([]);
      this.membershipsTotal.set(0);
      return;
    }
    try {
      const result = await firstValueFrom(
        this.membershipsApi.listForCustomer(customerId, {
          status: this.membershipStatus() || null,
          planId: this.membershipPlanId() || null,
          soldFrom: soldRange?.from ?? null,
          soldTo: soldRange?.to ?? null,
          page: this.membershipsPage(),
          pageSize: this.membershipsPageSize,
        }),
      );
      if (sequence === this.membershipsSequence) {
        this.memberships.set(result.items);
        this.membershipsTotal.set(result.totalCount);
      }
    } catch (error) {
      if (sequence === this.membershipsSequence) {
        this.memberships.set([]);
        this.membershipsTotal.set(0);
        this.membershipsError.set(getApiErrorMessage(error));
      }
    }
  }

  private applyMembershipQuery(params: ParamMap): void {
    this.membershipStatus.set(readOptionParam(params, 'membershipStatus', MEMBERSHIP_STATUSES));
    this.membershipPlanId.set(readTextParam(params, 'membershipPlanId'));
    this.membershipSoldFrom.set(readDateParam(params, 'membershipSoldFrom'));
    this.membershipSoldTo.set(readDateParam(params, 'membershipSoldTo'));
    this.membershipsPage.set(readPageParam(params, 'membershipPage'));
  }

  private navigateMemberships(patch: Record<string, QueryValue>): void {
    const queryParams: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(patch)) {
      queryParams[key] = value === undefined || value === '' || value === null ? null : String(value);
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
