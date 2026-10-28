import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  CustomerDetailView,
  CustomerEventType,
  CustomerEventView,
} from '../../../../../core/models/customer.models';
import { AdminCustomersApiService } from '../../../../../core/services/admin-customers-api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { AdminCustomerFormModalComponent } from '../../components/admin-customer-form-modal/admin-customer-form-modal.component';
import { AdminCustomerLinkAccountModalComponent } from '../../components/admin-customer-link-account-modal/admin-customer-link-account-modal.component';
import { AdminCustomerMergeModalComponent } from '../../components/admin-customer-merge-modal/admin-customer-merge-modal.component';
import { AdminCustomerUnlinkAccountModalComponent } from '../../components/admin-customer-unlink-account-modal/admin-customer-unlink-account-modal.component';

type CustomerModal = 'edit' | 'link' | 'unlink' | 'merge';

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
  ],
  templateUrl: './admin-customer-detail-page.component.html',
  styleUrl: './admin-customer-detail-page.component.scss',
})
export class AdminCustomerDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly adminCustomersApiService = inject(AdminCustomersApiService);
  private readonly toastService = inject(ToastService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly customer = signal<CustomerDetailView | null>(null);
  readonly openModal = signal<CustomerModal | null>(null);

  ngOnInit(): void {
    // Subscribing (not the snapshot) so following the "merged into" link reloads this same page.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const customerId = params.get('customerId');
      if (customerId) {
        void this.load(customerId);
      }
    });
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
  }
}
