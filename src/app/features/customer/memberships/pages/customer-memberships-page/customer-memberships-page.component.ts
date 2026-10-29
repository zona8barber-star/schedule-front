import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { MyMembershipSummaryView } from '../../../../../core/models/my-membership.models';
import { CustomerMembershipsApiService } from '../../../../../core/services/customer-memberships-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { MY_MEMBERSHIP_STATUS_LABELS, balanceAvailability } from '../../my-membership-labels';

/** "Mis membresías": read-only list of the memberships of the signed-in customer's linked profile. */
@Component({
  selector: 'app-customer-memberships-page',
  imports: [RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './customer-memberships-page.component.html',
  styleUrl: '../../my-memberships.scss',
})
export class CustomerMembershipsPageComponent implements OnInit {
  private readonly membershipsApi = inject(CustomerMembershipsApiService);

  readonly statusLabels = MY_MEMBERSHIP_STATUS_LABELS;
  readonly memberships = signal<MyMembershipSummaryView[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  availability(membership: MyMembershipSummaryView) {
    return balanceAvailability(membership.displayStatus, membership.startsOn, membership.endsOn);
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.memberships.set(await firstValueFrom(this.membershipsApi.list()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.memberships.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }
}
