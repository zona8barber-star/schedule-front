import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  CustomerMembershipDetailView,
  CustomerMembershipSummaryView,
  MembershipIncomeCandidateView,
} from '../../../../../core/models/membership.models';
import { AdminMembershipsApiService } from '../../../../../core/services/admin-memberships-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

const REASON_MIN_LENGTH = 3;

/**
 * Links a membership-sale income to this membership and, optionally, to other unlinked memberships of the
 * same customer paid with it. A justification is required when the income does not match their total.
 */
@Component({
  selector: 'app-admin-membership-income-link-modal',
  imports: [FormsModule, DecimalPipe, ApiFeedbackComponent],
  templateUrl: './admin-membership-income-link-modal.component.html',
  styleUrl: '../membership-modal.scss',
})
export class AdminMembershipIncomeLinkModalComponent implements OnInit {
  private readonly membershipsApi = inject(AdminMembershipsApiService);

  @Input({ required: true }) membership!: CustomerMembershipDetailView;
  @Output() readonly linked = new EventEmitter<CustomerMembershipDetailView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly date = signal('');
  readonly candidates = signal<MembershipIncomeCandidateView[]>([]);
  readonly selectedIncomeId = signal<string | null>(null);
  /** Other memberships of the customer that have no income yet. */
  readonly siblings = signal<CustomerMembershipSummaryView[]>([]);
  readonly includedSiblingIds = signal<string[]>([]);
  readonly justification = signal('');
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly selected = computed(
    () => this.candidates().find((candidate) => candidate.incomeEntryId === this.selectedIncomeId()) ?? null,
  );

  /** What the income would cover after linking: what it already covers plus this and the included memberships. */
  readonly projectedTotal = computed(() => {
    const selected = this.selected();
    if (!selected) return 0;
    const included = this.siblings()
      .filter((sibling) => this.includedSiblingIds().includes(sibling.id))
      .reduce((sum, sibling) => sum + sibling.price, 0);
    return selected.linkedMembershipsTotal + this.membership.price + included;
  });

  readonly hasDiscrepancy = computed(() => !!this.selected() && this.projectedTotal() !== this.selected()!.amount);

  readonly canConfirm = computed(
    () =>
      !!this.selected() &&
      !this.isSaving() &&
      (!this.hasDiscrepancy() || this.justification().trim().length >= REASON_MIN_LENGTH),
  );

  async ngOnInit(): Promise<void> {
    this.date.set(this.membership.soldOn);
    await Promise.all([this.loadCandidates(), this.loadSiblings()]);
  }

  async onDateChange(date: string): Promise<void> {
    this.date.set(date);
    this.selectedIncomeId.set(null);
    await this.loadCandidates();
  }

  toggleSibling(id: string, included: boolean): void {
    this.includedSiblingIds.update((ids) => (included ? [...ids, id] : ids.filter((candidate) => candidate !== id)));
  }

  async confirm(): Promise<void> {
    const selected = this.selected();
    if (!selected || !this.canConfirm()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(
        this.membershipsApi.linkIncome(this.membership.id, {
          incomeEntryId: selected.incomeEntryId,
          additionalMembershipIds: this.includedSiblingIds(),
          discrepancyJustification: this.hasDiscrepancy() ? this.justification().trim() : null,
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

  private async loadCandidates(): Promise<void> {
    if (!this.date()) {
      this.candidates.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.candidates.set(await firstValueFrom(this.membershipsApi.incomeCandidates(this.date())));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadSiblings(): Promise<void> {
    try {
      const all = await firstValueFrom(this.membershipsApi.listForCustomer(this.membership.customerId));
      this.siblings.set(all.filter((sibling) => sibling.id !== this.membership.id && !sibling.incomeEntryId));
    } catch {
      // Without siblings the admin can still link this membership alone.
      this.siblings.set([]);
    }
  }
}
