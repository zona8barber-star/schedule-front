import { BogotaDatePipe } from '../../../../../shared/pipes/bogota-date.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CUSTOMER_CLAIM_STATUS_LABELS, OwnCustomerStatusView } from '../../../../../core/models/customer-claim.models';
import { CustomerClaimsApiService } from '../../../../../core/services/customer-claims-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';
import { trimmedMinLength, trimmedRequired } from '../../../../../core/utils/form-validators';

const PHONE_PATTERN = /^(?=(?:\D*\d){7,})[\d\s()+-]+$/;

type Choice = 'new' | 'existing' | null;

/** The customer's own customer profile: shows it, or lets them create one or ask to be linked to their historical one. */
import { FieldErrorComponent } from '../../../../../shared/components/field-error/field-error.component';

@Component({
  selector: 'app-own-customer-profile-page',
  imports: [FieldErrorComponent, BogotaDatePipe, ReactiveFormsModule, RouterLink, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './own-customer-profile-page.component.html',
  styleUrl: './own-customer-profile-page.component.scss',
})
export class OwnCustomerProfilePageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(CustomerClaimsApiService);

  readonly statusLabels = CUSTOMER_CLAIM_STATUS_LABELS;

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly status = signal<OwnCustomerStatusView | null>(null);
  readonly choice = signal<Choice>(null);

  /** Generated once per intended claim, so a retried submit is not stored twice. */
  private claimKey = crypto.randomUUID();

  readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(120)]],
    phone: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(PHONE_PATTERN)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  choose(choice: Choice): void {
    this.choice.set(choice);
    this.errorMessage.set(null);
    const account = this.status();
    this.form.reset({
      fullName: account?.accountFullName ?? '',
      phone: account?.accountPhone ?? '',
      email: account?.accountEmail ?? '',
      notes: '',
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.isSaving.set(true);
    this.errorMessage.set(null);
    try {
      if (this.choice() === 'new') {
        await firstValueFrom(
          this.api.createOwnProfile({ fullName: value.fullName.trim(), phone: value.phone.trim(), email: value.email.trim() }),
        );
        this.successMessage.set('Listo: ya tienes tu perfil de cliente.');
      } else {
        await firstValueFrom(
          this.api.submitClaim({
            fullName: value.fullName.trim(),
            phone: value.phone.trim(),
            email: value.email.trim(),
            notes: value.notes.trim() || null,
            idempotencyKey: this.claimKey,
          }),
        );
        this.claimKey = crypto.randomUUID();
        this.successMessage.set('Solicitud enviada. La barbería verificará tu identidad en persona antes de vincular tu perfil.');
      }
      this.choice.set(null);
      await this.load(false);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  private async load(showLoading = true): Promise<void> {
    if (showLoading) {
      this.isLoading.set(true);
    }
    try {
      this.status.set(await firstValueFrom(this.api.ownStatus()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
