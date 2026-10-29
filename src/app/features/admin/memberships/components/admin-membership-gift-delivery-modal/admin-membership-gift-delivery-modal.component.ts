import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { CustomerMembershipDetailView, MembershipGiftView } from '../../../../../core/models/membership.models';
import { AdminMembershipsApiService } from '../../../../../core/services/admin-memberships-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { bogotaToday } from '../../membership-labels';

/**
 * Registers that a physical gift was handed over, always complete (no partial deliveries). One key per opened
 * modal makes a retried save count once; the server re-checks every rule.
 */
@Component({
  selector: 'app-admin-membership-gift-delivery-modal',
  imports: [FormsModule, ApiFeedbackComponent],
  templateUrl: './admin-membership-gift-delivery-modal.component.html',
  styleUrl: '../membership-modal.scss',
})
export class AdminMembershipGiftDeliveryModalComponent implements OnInit {
  private readonly membershipsApi = inject(AdminMembershipsApiService);

  @Input({ required: true }) membership!: CustomerMembershipDetailView;
  @Input({ required: true }) gift!: MembershipGiftView;
  @Output() readonly delivered = new EventEmitter<CustomerMembershipDetailView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly idempotencyKey = crypto.randomUUID();
  readonly today = bogotaToday();

  readonly deliveredOn = signal('');
  readonly isSaving = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly problems = computed(() => {
    const date = this.deliveredOn();
    if (!date) return ['Indica la fecha real de la entrega.'];
    if (date > this.today) return ['La fecha de entrega no puede ser futura.'];
    if (date < this.membership.soldOn) return [`La fecha de entrega no puede ser anterior a la venta (${this.membership.soldOn}).`];
    return [];
  });

  ngOnInit(): void {
    this.deliveredOn.set(this.today);
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.problems().length > 0) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      const result = await firstValueFrom(
        this.membershipsApi.deliverGift(this.membership.id, this.gift.id, {
          deliveredOn: this.deliveredOn(),
          idempotencyKey: this.idempotencyKey,
        }),
      );
      this.delivered.emit(result);
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
