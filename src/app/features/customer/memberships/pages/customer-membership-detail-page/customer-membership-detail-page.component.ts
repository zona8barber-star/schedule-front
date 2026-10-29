import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { MyMembershipConsumptionView, MyMembershipView } from '../../../../../core/models/my-membership.models';
import { CustomerMembershipsApiService } from '../../../../../core/services/customer-memberships-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { MY_GIFT_STATUS_LABELS, MY_MEMBERSHIP_STATUS_LABELS, balanceAvailability } from '../../my-membership-labels';

/** Read-only detail of one of the signed-in customer's memberships. */
@Component({
  selector: 'app-customer-membership-detail-page',
  imports: [DatePipe, DecimalPipe, RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './customer-membership-detail-page.component.html',
  styleUrl: '../../my-memberships.scss',
})
export class CustomerMembershipDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly membershipsApi = inject(CustomerMembershipsApiService);

  readonly statusLabels = MY_MEMBERSHIP_STATUS_LABELS;
  readonly giftStatusLabels = MY_GIFT_STATUS_LABELS;

  readonly membership = signal<MyMembershipView | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly availability = computed(() => {
    const membership = this.membership();
    return membership ? balanceAvailability(membership.displayStatus, membership.startsOn, membership.endsOn) : null;
  });

  /** Paid and gifted units, original, used and still available. */
  readonly totals = computed(() => {
    const balances = this.membership()?.balances ?? [];
    const sum = (origin: 'Purchased' | 'Gift', pick: (line: MyMembershipView['balances'][number]) => number) =>
      balances.filter((line) => line.origin === origin).reduce((total, line) => total + pick(line), 0);
    return {
      purchased: {
        granted: sum('Purchased', (line) => line.grantedQuantity),
        consumed: sum('Purchased', (line) => line.consumedQuantity),
        available: sum('Purchased', (line) => line.availableQuantity),
      },
      gifted: {
        granted: sum('Gift', (line) => line.grantedQuantity),
        consumed: sum('Gift', (line) => line.consumedQuantity),
        available: sum('Gift', (line) => line.availableQuantity),
      },
    };
  });

  readonly includedServices = computed(() => (this.membership()?.balances ?? []).filter((line) => line.origin === 'Purchased'));
  readonly serviceGifts = computed(() => (this.membership()?.gifts ?? []).filter((gift) => gift.kind === 'Service'));
  readonly physicalGifts = computed(() => (this.membership()?.gifts ?? []).filter((gift) => gift.kind === 'Physical'));

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const membershipId = params.get('membershipId');
      if (membershipId) {
        void this.load(membershipId);
      }
    });
  }

  partsLabel(consumption: MyMembershipConsumptionView): string {
    const count = (origin: 'Purchased' | 'Gift') =>
      consumption.parts.filter((part) => part.origin === origin).reduce((total, part) => total + part.quantity, 0);
    const parts: string[] = [];
    if (count('Gift')) parts.push(`${count('Gift')} regalado(s)`);
    if (count('Purchased')) parts.push(`${count('Purchased')} pagado(s)`);
    return parts.join(' + ');
  }

  private async load(membershipId: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.membership.set(await firstValueFrom(this.membershipsApi.getById(membershipId)));
    } catch (error) {
      this.membership.set(null);
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
