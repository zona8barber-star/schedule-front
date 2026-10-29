import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CustomerDetailView, CustomerListItem } from '../../../../../core/models/customer.models';
import { AdminCustomersApiService } from '../../../../../core/services/admin-customers-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
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
    AdminCustomerFormModalComponent,
    AdminCustomerFromAccountModalComponent,
  ],
  templateUrl: './admin-customers-list-page.component.html',
  styleUrl: './admin-customers-list-page.component.scss',
})
export class AdminCustomersListPageComponent implements OnInit {
  private readonly adminCustomersApiService = inject(AdminCustomersApiService);
  private readonly router = inject(Router);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly customers = signal<CustomerListItem[]>([]);
  readonly query = signal('');
  readonly openModal = signal<'create' | 'fromAccount' | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  search(): void {
    void this.load();
  }

  clearSearch(): void {
    this.query.set('');
    void this.load();
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

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.customers.set(await firstValueFrom(this.adminCustomersApiService.search(this.query())));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
