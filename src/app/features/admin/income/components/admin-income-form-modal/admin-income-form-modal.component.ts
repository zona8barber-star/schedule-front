import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { IncomeEntryView } from '../../../../../core/models/income.models';
import { AdminIncomeApiService } from '../../../../../core/services/admin-income-api.service';
import { AdminServicesApiService } from '../../../../../core/services/admin-services-api.service';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

function integerValidator(control: AbstractControl): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

@Component({
  selector: 'app-admin-income-form-modal',
  imports: [ReactiveFormsModule, DecimalPipe, ApiFeedbackComponent],
  templateUrl: './admin-income-form-modal.component.html',
  styleUrl: './admin-income-form-modal.component.scss',
})
export class AdminIncomeFormModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly incomeApi = inject(AdminIncomeApiService);
  private readonly servicesApi = inject(AdminServicesApiService);
  private readonly staffApi = inject(AdminStaffApiService);

  @Input() entry: IncomeEntryView | null = null;
  @Input() defaultDate = '';
  @Output() readonly saved = new EventEmitter<IncomeEntryView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly serviceOptions = signal<{ id: string; name: string; basePrice: number }[]>([]);
  readonly staffOptions = signal<{ staffProfileId: string; displayName: string }[]>([]);
  readonly isSaving = signal(false);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isBusy = computed(() => this.isSaving() || this.isLoading());

  readonly form = this.formBuilder.nonNullable.group({
    serviceId: ['', [Validators.required]],
    staffProfileId: ['', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0), integerValidator]],
    isPromo: [false],
    occurredOn: ['', [Validators.required]],
  });

  get isEditing(): boolean {
    return this.entry !== null;
  }

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [services, staff] = await Promise.all([
        firstValueFrom(this.servicesApi.list()),
        firstValueFrom(this.staffApi.list()),
      ]);

      const activeServiceOptions = services
        .filter((s) => s.isActive)
        .map((s) => ({ id: s.id, name: s.name, basePrice: s.basePrice }));
      const activeStaffOptions = staff
        .filter((s) => s.isActive)
        .map((s) => ({ staffProfileId: s.staffProfileId, displayName: s.displayName }));

      if (this.entry && !activeServiceOptions.some((s) => s.id === this.entry!.serviceId)) {
        activeServiceOptions.unshift({
          id: this.entry.serviceId,
          name: this.entry.serviceName,
          basePrice: this.entry.basePrice,
        });
      }
      if (this.entry && !activeStaffOptions.some((s) => s.staffProfileId === this.entry!.staffProfileId)) {
        activeStaffOptions.unshift({
          staffProfileId: this.entry.staffProfileId,
          displayName: this.entry.staffDisplayName,
        });
      }

      this.serviceOptions.set(activeServiceOptions);
      this.staffOptions.set(activeStaffOptions);

      if (this.entry) {
        this.form.patchValue({
          serviceId: this.entry.serviceId,
          staffProfileId: this.entry.staffProfileId,
          amount: this.entry.amount,
          isPromo: this.entry.isPromo,
          occurredOn: this.entry.occurredOn,
        });
      } else {
        this.form.patchValue({ occurredOn: this.defaultDate });
      }
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  onServiceChange(serviceId: string): void {
    const service = this.serviceOptions().find((s) => s.id === serviceId);
    if (service && !this.isEditing) {
      this.form.patchValue({ amount: service.basePrice });
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const payload = {
      serviceId: this.form.controls.serviceId.value,
      staffProfileId: this.form.controls.staffProfileId.value,
      amount: Math.trunc(this.form.controls.amount.value),
      isPromo: this.form.controls.isPromo.value,
      occurredOn: this.form.controls.occurredOn.value,
    };

    try {
      const result = this.entry
        ? await firstValueFrom(this.incomeApi.update(this.entry.id, payload))
        : await firstValueFrom(this.incomeApi.create(payload));
      this.saved.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  cancel(): void {
    if (this.isBusy()) {
      return;
    }
    this.cancelled.emit();
  }
}
