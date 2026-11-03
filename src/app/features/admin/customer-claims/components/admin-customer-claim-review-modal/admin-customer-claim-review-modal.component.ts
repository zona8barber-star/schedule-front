import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { CustomerClaimCandidate, CustomerClaimView } from '../../../../../core/models/customer-claim.models';
import { CustomerClaimsApiService } from '../../../../../core/services/customer-claims-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

/**
 * Approves (linking the account to the chosen profile, after verifying the identity in person) or rejects one claim.
 * Candidates are suggestions from the data the customer sent; nothing is linked until the reviewer confirms.
 */
@Component({
  selector: 'app-admin-customer-claim-review-modal',
  imports: [DatePipe, ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-customer-claim-review-modal.component.html',
  styleUrl: '../../../service-records/components/admin-service-record-review-modal/admin-service-record-review-modal.component.scss',
})
export class AdminCustomerClaimReviewModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(CustomerClaimsApiService);

  @Input({ required: true }) claim!: CustomerClaimView;
  @Output() readonly reviewed = new EventEmitter<CustomerClaimView>();
  @Output() readonly cancelled = new EventEmitter<void>();
  @Output() readonly staleDetected = new EventEmitter<void>();

  readonly candidates = signal<CustomerClaimCandidate[]>([]);
  readonly selected = signal<CustomerClaimCandidate | null>(null);
  readonly isSearching = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hasConflict = signal(false);
  readonly rejecting = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    query: [''],
    identityVerified: [false],
    notes: ['', [Validators.maxLength(500)]],
    reason: ['', [Validators.maxLength(500)]],
  });

  async ngOnInit(): Promise<void> {
    await this.search();
  }

  async search(): Promise<void> {
    this.isSearching.set(true);
    try {
      this.candidates.set(await firstValueFrom(this.api.candidates(this.claim.id, this.form.controls.query.value)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSearching.set(false);
    }
  }

  select(candidate: CustomerClaimCandidate): void {
    if (!candidate.isLinked) {
      this.selected.set(candidate);
    }
  }

  describeMatch(candidate: CustomerClaimCandidate): string {
    return candidate.matchedOn.map((field) => (field === 'email' ? 'correo' : 'teléfono')).join(' y ');
  }

  async approve(): Promise<void> {
    const candidate = this.selected();
    if (!candidate) {
      this.errorMessage.set('Elige el perfil del cliente.');
      return;
    }
    if (!this.form.controls.identityVerified.value) {
      this.errorMessage.set('Confirma que verificaste la identidad del cliente en persona.');
      return;
    }
    await this.run(() =>
      this.api.approve(this.claim.id, {
        version: this.claim.version,
        customerId: candidate.customerId,
        identityVerified: true,
        notes: this.form.controls.notes.value.trim() || null,
      }),
    );
  }

  async reject(): Promise<void> {
    const reason = this.form.controls.reason.value.trim();
    if (reason.length < 3) {
      this.errorMessage.set('Escribe el motivo del rechazo (al menos 3 caracteres).');
      return;
    }
    await this.run(() => this.api.reject(this.claim.id, { version: this.claim.version, reason }));
  }

  cancel(): void {
    if (!this.isSaving()) {
      this.cancelled.emit();
    }
  }

  private async run(action: () => ReturnType<CustomerClaimsApiService['approve']>): Promise<void> {
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.hasConflict.set(false);
    try {
      this.reviewed.emit(await firstValueFrom(action()));
    } catch (error) {
      this.hasConflict.set(error instanceof HttpErrorResponse && error.status === 409);
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 403
          ? 'Ya no tienes permiso para aprobar reclamaciones de clientes.'
          : getApiErrorMessage(error),
      );
    } finally {
      this.isSaving.set(false);
    }
  }
}
