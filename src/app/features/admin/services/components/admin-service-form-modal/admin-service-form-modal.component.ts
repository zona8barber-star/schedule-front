import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ServiceView } from '../../../../../core/models/service.models';
import { AdminServicesApiService } from '../../../../../core/services/admin-services-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

@Component({
  selector: 'app-admin-service-form-modal',
  imports: [ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-service-form-modal.component.html',
  styleUrl: './admin-service-form-modal.component.scss',
})
export class AdminServiceFormModalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminServicesApiService = inject(AdminServicesApiService);

  @Input() serviceId: string | null = null;
  @Output() readonly saved = new EventEmitter<ServiceView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly isSaving = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    basePrice: [0, [Validators.required, Validators.min(0)]],
  });

  get isEditing(): boolean {
    return this.serviceId !== null;
  }

  async ngOnInit(): Promise<void> {
    if (!this.serviceId) {
      return;
    }

    this.isLoading.set(true);
    try {
      const service = await firstValueFrom(this.adminServicesApiService.getById(this.serviceId));
      this.form.patchValue({ name: service.name, basePrice: service.basePrice });
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
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
      name: this.form.controls.name.value.trim(),
      basePrice: Math.trunc(this.form.controls.basePrice.value),
    };

    try {
      const result = this.serviceId
        ? await firstValueFrom(this.adminServicesApiService.update(this.serviceId, payload))
        : await firstValueFrom(this.adminServicesApiService.create(payload));
      this.saved.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
