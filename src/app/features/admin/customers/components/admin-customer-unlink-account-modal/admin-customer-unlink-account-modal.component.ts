import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { CustomerDetailView } from '../../../../../core/models/customer.models';
import { AdminCustomersApiService } from '../../../../../core/services/admin-customers-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

const REASON_MIN_LENGTH = 3;
const REASON_MAX_LENGTH = 500;

@Component({
  selector: 'app-admin-customer-unlink-account-modal',
  imports: [FormsModule, ApiFeedbackComponent],
  templateUrl: './admin-customer-unlink-account-modal.component.html',
  styleUrl: '../customer-modal.scss',
})
export class AdminCustomerUnlinkAccountModalComponent {
  private readonly adminCustomersApiService = inject(AdminCustomersApiService);

  @Input({ required: true }) customer!: CustomerDetailView;
  @Output() readonly unlinked = new EventEmitter<CustomerDetailView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly reasonMaxLength = REASON_MAX_LENGTH;
  readonly reason = signal('');
  readonly confirmed = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly reasonIsValid = computed(() => {
    const length = this.reason().trim().length;
    return length >= REASON_MIN_LENGTH && length <= REASON_MAX_LENGTH;
  });
  readonly canConfirm = computed(() => this.reasonIsValid() && this.confirmed() && !this.isSaving());

  async confirm(): Promise<void> {
    if (!this.canConfirm()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(
        this.adminCustomersApiService.unlinkAccount(this.customer.id, { reason: this.reason().trim() }),
      );
      this.unlinked.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  cancel(): void {
    if (this.isSaving()) {
      return;
    }
    this.cancelled.emit();
  }
}
