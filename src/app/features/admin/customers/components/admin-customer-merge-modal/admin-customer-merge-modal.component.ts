import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  CustomerDetailView,
  CustomerListItem,
  CustomerMergePreview,
} from '../../../../../core/models/customer.models';
import { AdminCustomersApiService } from '../../../../../core/services/admin-customers-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

/** Merges a duplicate profile (the source) into the customer being viewed (the target, which survives). */
@Component({
  selector: 'app-admin-customer-merge-modal',
  imports: [FormsModule, ApiFeedbackComponent],
  templateUrl: './admin-customer-merge-modal.component.html',
  styleUrl: '../customer-modal.scss',
})
export class AdminCustomerMergeModalComponent {
  private readonly adminCustomersApiService = inject(AdminCustomersApiService);

  @Input({ required: true }) customer!: CustomerDetailView;
  @Output() readonly merged = new EventEmitter<CustomerDetailView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly query = signal('');
  readonly results = signal<CustomerListItem[]>([]);
  readonly hasSearched = signal(false);
  readonly preview = signal<CustomerMergePreview | null>(null);
  readonly confirmed = signal(false);
  readonly isBusy = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly canConfirm = computed(
    () => (this.preview()?.canMerge ?? false) && this.confirmed() && !this.isBusy(),
  );

  async search(): Promise<void> {
    this.isBusy.set(true);
    this.errorMessage.set(null);
    try {
      const found = await firstValueFrom(this.adminCustomersApiService.search(this.query()));
      this.results.set(found.filter((candidate) => candidate.id !== this.customer.id));
      this.hasSearched.set(true);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isBusy.set(false);
    }
  }

  async choose(source: CustomerListItem): Promise<void> {
    this.isBusy.set(true);
    this.errorMessage.set(null);
    this.confirmed.set(false);
    try {
      this.preview.set(
        await firstValueFrom(this.adminCustomersApiService.getMergePreview(this.customer.id, source.id)),
      );
    } catch (error) {
      this.preview.set(null);
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isBusy.set(false);
    }
  }

  async confirm(): Promise<void> {
    const preview = this.preview();
    if (!preview || !this.canConfirm()) {
      return;
    }

    this.isBusy.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(
        this.adminCustomersApiService.merge(this.customer.id, { sourceCustomerId: preview.source.id }),
      );
      this.merged.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isBusy.set(false);
    }
  }

  cancel(): void {
    if (this.isBusy()) {
      return;
    }
    this.cancelled.emit();
  }
}
