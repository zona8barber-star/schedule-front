import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  CustomerAccountCandidate,
  CustomerDetailView,
} from '../../../../../core/models/customer.models';
import { AdminCustomersApiService } from '../../../../../core/services/admin-customers-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

@Component({
  selector: 'app-admin-customer-link-account-modal',
  imports: [FormsModule, ApiFeedbackComponent],
  templateUrl: './admin-customer-link-account-modal.component.html',
  styleUrl: '../customer-modal.scss',
})
export class AdminCustomerLinkAccountModalComponent implements OnInit {
  private readonly adminCustomersApiService = inject(AdminCustomersApiService);

  @Input({ required: true }) customer!: CustomerDetailView;
  @Output() readonly linked = new EventEmitter<CustomerDetailView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly query = signal('');
  readonly candidates = signal<CustomerAccountCandidate[]>([]);
  readonly selectedUserId = signal<string | null>(null);
  readonly identityVerified = signal(false);
  readonly isSearching = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly selected = computed(
    () => this.candidates().find((candidate) => candidate.userId === this.selectedUserId()) ?? null,
  );
  readonly canConfirm = computed(
    () => this.selected() !== null && this.identityVerified() && !this.isSaving(),
  );

  ngOnInit(): void {
    // Start with the customer's own email so the most likely account is listed first.
    this.query.set(this.customer.email);
    void this.search();
  }

  async search(): Promise<void> {
    this.isSearching.set(true);
    this.errorMessage.set(null);
    try {
      const results = await firstValueFrom(this.adminCustomersApiService.getAccountCandidates(this.query()));
      this.candidates.set(results);
      if (!results.some((candidate) => candidate.userId === this.selectedUserId())) {
        this.selectedUserId.set(null);
      }
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSearching.set(false);
    }
  }

  select(userId: string): void {
    this.selectedUserId.set(userId);
    // Verification applies to one specific account; choosing another one requires confirming again.
    this.identityVerified.set(false);
  }

  async confirm(): Promise<void> {
    const selected = this.selected();
    if (!selected || !this.identityVerified()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(
        this.adminCustomersApiService.linkAccount(this.customer.id, {
          userId: selected.userId,
          identityVerified: true,
        }),
      );
      this.linked.emit(result);
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
