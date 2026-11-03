import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CustomerClaimStatus, CustomerClaimView } from '../../../../../core/models/customer-claim.models';
import { CustomerClaimsApiService } from '../../../../../core/services/customer-claims-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { AdminCustomerClaimReviewModalComponent } from '../../components/admin-customer-claim-review-modal/admin-customer-claim-review-modal.component';

const TABS: { status: CustomerClaimStatus; label: string }[] = [
  { status: 'Pending', label: 'Pendientes' },
  { status: 'Approved', label: 'Aprobadas' },
  { status: 'Rejected', label: 'Rechazadas' },
];

@Component({
  selector: 'app-admin-customer-claims-page',
  imports: [DatePipe, ApiFeedbackComponent, PageStateComponent, AdminCustomerClaimReviewModalComponent],
  templateUrl: './admin-customer-claims-page.component.html',
  styleUrl: '../../../service-records/pages/admin-service-records-page/admin-service-records-page.component.scss',
})
export class AdminCustomerClaimsPageComponent implements OnInit {
  private readonly api = inject(CustomerClaimsApiService);

  readonly tabs = TABS;
  readonly status = signal<CustomerClaimStatus>('Pending');
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly claims = signal<CustomerClaimView[]>([]);
  readonly reviewing = signal<CustomerClaimView | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async selectTab(status: CustomerClaimStatus): Promise<void> {
    this.status.set(status);
    this.successMessage.set(null);
    await this.load();
  }

  onReviewed(result: CustomerClaimView): void {
    this.claims.update((list) => list.filter((claim) => claim.id !== result.id));
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

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.claims.set(await firstValueFrom(this.api.list(this.status())));
    } catch (error) {
      this.claims.set([]);
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
