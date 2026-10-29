import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

const REASON_MIN_LENGTH = 3;
const REASON_MAX_LENGTH = 500;

/**
 * Asks for a reason (and optionally an explicit confirmation) before an audited action: annulling,
 * activating an expired membership or unlinking an income that leaves a discrepancy.
 */
@Component({
  selector: 'app-admin-membership-reason-modal',
  imports: [FormsModule, ApiFeedbackComponent],
  templateUrl: './admin-membership-reason-modal.component.html',
  styleUrl: '../membership-modal.scss',
})
export class AdminMembershipReasonModalComponent {
  @Input({ required: true }) title!: string;
  @Input() message: string | null = null;
  @Input() reasonLabel = 'Motivo (obligatorio)';
  @Input() reasonRequired = true;
  /** When set, the admin must also tick this confirmation. */
  @Input() confirmationText: string | null = null;
  @Input() confirmLabel = 'Confirmar';
  @Input() danger = false;
  @Input() isBusy = false;
  @Input() errorMessage: string | null = null;

  @Output() readonly confirmed = new EventEmitter<string | null>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly reasonMaxLength = REASON_MAX_LENGTH;
  readonly reason = signal('');
  readonly checked = signal(false);

  readonly reasonIsValid = computed(() => {
    const length = this.reason().trim().length;
    return this.reasonRequired ? length >= REASON_MIN_LENGTH : length === 0 || length >= REASON_MIN_LENGTH;
  });

  canConfirm(): boolean {
    return this.reasonIsValid() && (!this.confirmationText || this.checked()) && !this.isBusy;
  }

  confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
    this.confirmed.emit(this.reason().trim() || null);
  }

  cancel(): void {
    if (this.isBusy) {
      return;
    }
    this.cancelled.emit();
  }
}
