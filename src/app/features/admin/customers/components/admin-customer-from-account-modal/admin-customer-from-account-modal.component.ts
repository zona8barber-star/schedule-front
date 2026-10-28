import { Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  CustomerAccountCandidate,
  CustomerDetailView,
  CustomerDuplicateCandidate,
} from '../../../../../core/models/customer.models';
import { AdminCustomersApiService } from '../../../../../core/services/admin-customers-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

const MIN_PHONE_DIGITS = 7;

/**
 * Creates a profile from a registered account and links it in one step. If a profile without an
 * account already matches, it offers to link the account to that profile instead.
 */
@Component({
  selector: 'app-admin-customer-from-account-modal',
  imports: [FormsModule, ApiFeedbackComponent],
  templateUrl: './admin-customer-from-account-modal.component.html',
  styleUrl: '../customer-modal.scss',
})
export class AdminCustomerFromAccountModalComponent implements OnInit {
  private readonly adminCustomersApiService = inject(AdminCustomersApiService);

  @Output() readonly saved = new EventEmitter<CustomerDetailView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly query = signal('');
  readonly candidates = signal<CustomerAccountCandidate[]>([]);
  readonly selectedUserId = signal<string | null>(null);
  readonly phone = signal('');
  readonly identityVerified = signal(false);
  readonly duplicates = signal<CustomerDuplicateCandidate[]>([]);
  readonly isSearching = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Account + phone combination whose duplicates were already shown to the admin. */
  private checkedKey: string | null = null;

  readonly selected = computed(
    () => this.candidates().find((candidate) => candidate.userId === this.selectedUserId()) ?? null,
  );
  readonly phoneIsValid = computed(() => this.phone().replace(/\D/g, '').length >= MIN_PHONE_DIGITS);
  readonly canCreate = computed(
    () => this.selected() !== null && this.phoneIsValid() && this.identityVerified() && !this.isSaving(),
  );

  ngOnInit(): void {
    void this.search();
  }

  async search(): Promise<void> {
    this.isSearching.set(true);
    this.errorMessage.set(null);
    try {
      const results = await firstValueFrom(this.adminCustomersApiService.getAccountCandidates(this.query()));
      this.candidates.set(results);
      if (!results.some((candidate) => candidate.userId === this.selectedUserId())) {
        this.clearSelection();
      }
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSearching.set(false);
    }
  }

  async select(candidate: CustomerAccountCandidate): Promise<void> {
    this.selectedUserId.set(candidate.userId);
    this.phone.set(candidate.phoneNumber ?? '');
    // Verification applies to one specific account; choosing another one requires confirming again.
    this.identityVerified.set(false);
    await this.checkDuplicates();
  }

  onPhoneChange(value: string): void {
    this.phone.set(value);
    if (this.checkedKey !== null && this.checkedKey !== this.currentKey()) {
      this.checkedKey = null;
      this.duplicates.set([]);
    }
  }

  async create(): Promise<void> {
    const selected = this.selected();
    if (!selected || !this.canCreate()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      if (this.checkedKey !== this.currentKey()) {
        const found = await this.fetchDuplicates(selected);
        if (found.length > 0) {
          // Show them first; a second click with the same data creates the profile anyway.
          return;
        }
      }

      const result = await firstValueFrom(
        this.adminCustomersApiService.createFromAccount({
          userId: selected.userId,
          phone: this.phone().trim() || null,
          identityVerified: true,
        }),
      );
      this.saved.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  async linkToExisting(profile: CustomerDuplicateCandidate): Promise<void> {
    const selected = this.selected();
    if (!selected || !this.identityVerified() || profile.isLinked) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(
        this.adminCustomersApiService.linkAccount(profile.id, {
          userId: selected.userId,
          identityVerified: true,
        }),
      );
      this.saved.emit(result);
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

  private async checkDuplicates(): Promise<void> {
    const selected = this.selected();
    if (!selected) {
      return;
    }

    try {
      await this.fetchDuplicates(selected);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    }
  }

  /** Only other profiles matter here: the selected account is excluded and other accounts are not candidates. */
  private async fetchDuplicates(selected: CustomerAccountCandidate): Promise<CustomerDuplicateCandidate[]> {
    const found = await firstValueFrom(
      this.adminCustomersApiService.findDuplicates(selected.email, this.phone().trim(), null, selected.userId),
    );
    const profiles = found.filter((candidate) => candidate.kind === 'customer');
    this.duplicates.set(profiles);
    this.checkedKey = this.currentKey();
    return profiles;
  }

  private clearSelection(): void {
    this.selectedUserId.set(null);
    this.phone.set('');
    this.identityVerified.set(false);
    this.duplicates.set([]);
    this.checkedKey = null;
  }

  private currentKey(): string {
    return `${this.selectedUserId()}|${this.phone().replace(/\D/g, '')}`;
  }
}
