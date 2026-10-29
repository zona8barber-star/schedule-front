import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  CustomerDetailView,
  CustomerDuplicateCandidate,
} from '../../../../../core/models/customer.models';
import { AdminCustomersApiService } from '../../../../../core/services/admin-customers-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

const PHONE_PATTERN = /^(?=(?:\D*\d){7,})[\d\s()+-]+$/;

@Component({
  selector: 'app-admin-customer-form-modal',
  imports: [ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-customer-form-modal.component.html',
  styleUrl: '../customer-modal.scss',
})
export class AdminCustomerFormModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminCustomersApiService = inject(AdminCustomersApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** The customer being edited, or null to create a new one. */
  @Input() customer: CustomerDetailView | null = null;
  @Output() readonly saved = new EventEmitter<CustomerDetailView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly duplicates = signal<CustomerDuplicateCandidate[]>([]);

  /** Contact data the admin already reviewed duplicates for; editing it re-runs the check. */
  private acknowledgedKey: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(PHONE_PATTERN)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
  });

  get isEditing(): boolean {
    return this.customer !== null;
  }

  ngOnInit(): void {
    if (this.customer) {
      this.form.patchValue({
        fullName: this.customer.fullName,
        phone: this.customer.phone,
        email: this.customer.email,
      });
    }

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.acknowledgedKey !== null && this.acknowledgedKey !== this.contactKey()) {
        this.acknowledgedKey = null;
        this.duplicates.set([]);
      }
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      fullName: this.form.controls.fullName.value.trim(),
      phone: this.form.controls.phone.value.trim(),
      email: this.form.controls.email.value.trim(),
    };
    const contactKey = this.contactKey();

    this.isSaving.set(true);
    this.errorMessage.set(null);

    try {
      if (this.acknowledgedKey !== contactKey) {
        const found = await firstValueFrom(
          this.adminCustomersApiService.findDuplicates(payload.email, payload.phone, this.customer?.id),
        );
        if (found.length > 0) {
          // Warn once; a second submit with the same contact data saves anyway.
          this.duplicates.set(found);
          this.acknowledgedKey = contactKey;
          return;
        }
      }

      const result = this.customer
        ? await firstValueFrom(this.adminCustomersApiService.update(this.customer.id, payload))
        : await firstValueFrom(this.adminCustomersApiService.create(payload));
      this.saved.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  describeMatch(candidate: CustomerDuplicateCandidate): string {
    const source = candidate.kind === 'account' ? 'Cuenta de la app' : 'Cliente';
    const fields = candidate.matchedOn.map((field) => (field === 'email' ? 'correo' : 'teléfono')).join(' y ');
    return `${source} con el mismo ${fields}`;
  }

  cancel(): void {
    if (this.isSaving()) {
      return;
    }
    this.cancelled.emit();
  }

  private contactKey(): string {
    const { email, phone } = this.form.getRawValue();
    return `${email.trim().toLowerCase()}|${phone.trim()}`;
  }
}
