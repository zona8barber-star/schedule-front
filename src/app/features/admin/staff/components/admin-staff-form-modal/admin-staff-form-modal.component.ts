import { DOCUMENT } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { StaffResponse } from '../../../../../core/models/staff.models';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

@Component({
  selector: 'app-admin-staff-form-modal',
  imports: [ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-staff-form-modal.component.html',
  styleUrl: './admin-staff-form-modal.component.scss',
})
export class AdminStaffFormModalComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminStaffApiService = inject(AdminStaffApiService);
  private readonly document = inject(DOCUMENT);

  readonly staffId = input<string | null>(null);

  readonly saved = output<StaffResponse>();
  readonly cancelled = output<void>();

  readonly submitted = signal(false);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hasRecord = signal(true);

  readonly isEditMode = computed(() => this.staffId() !== null);
  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'Editar profesional' : 'Nuevo profesional',
  );
  readonly submitLabel = computed(() => {
    if (this.isSubmitting()) {
      return this.isEditMode() ? 'Guardando...' : 'Creando...';
    }
    return this.isEditMode() ? 'Guardar cambios' : 'Crear profesional';
  });
  readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());

  readonly staffForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    initialPassword: ['', [Validators.minLength(8), Validators.maxLength(128)]],
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phoneNumber: ['', [Validators.maxLength(40)]],
    isActive: [true],
  });

  ngOnInit(): void {
    if (this.document?.body) {
      this.document.body.style.overflow = 'hidden';
    }

    if (this.isEditMode()) {
      void this.loadStaff();
    } else {
      this.staffForm.controls.initialPassword.addValidators(Validators.required);
      this.staffForm.controls.initialPassword.updateValueAndValidity({ emitEvent: false });
    }
  }

  ngOnDestroy(): void {
    if (this.document?.body) {
      this.document.body.style.overflow = '';
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.cancel();
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set(null);

    if (this.staffForm.invalid || (this.isEditMode() && !this.hasRecord())) {
      this.staffForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.staffForm.getRawValue();

    try {
      let result: StaffResponse;

      const currentStaffId = this.staffId();
      if (this.isEditMode() && currentStaffId) {
        result = await firstValueFrom(
          this.adminStaffApiService.update(currentStaffId, {
            fullName: normalizeRequired(formValue.fullName),
            email: normalizeRequired(formValue.email),
            displayName: normalizeRequired(formValue.displayName),
            phoneNumber: normalizeOptional(formValue.phoneNumber),
            bio: null,
            defaultAppointmentDurationMinutes: 0,
            photoMediaAssetId: null,
            tipsQrMediaAssetId: null,
            isActive: formValue.isActive ?? true,
          }),
        );
      } else {
        result = await firstValueFrom(
          this.adminStaffApiService.create({
            fullName: normalizeRequired(formValue.fullName),
            email: normalizeRequired(formValue.email),
            displayName: normalizeRequired(formValue.displayName),
            initialPassword: normalizeRequired(formValue.initialPassword),
            phoneNumber: normalizeOptional(formValue.phoneNumber),
            bio: null,
            defaultAppointmentDurationMinutes: 0,
            photoMediaAssetId: null,
            tipsQrMediaAssetId: null,
            isActive: formValue.isActive ?? true,
          }),
        );
      }

      this.saved.emit(result);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  cancel(): void {
    if (this.isBusy()) {
      return;
    }
    this.cancelled.emit();
  }

  showError(
    controlName: 'fullName' | 'email' | 'initialPassword' | 'displayName' | 'phoneNumber',
    errorName: string,
  ): boolean {
    const control = this.staffForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }

  private async loadStaff(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const staffId = this.staffId();
      if (!staffId) return;
      const staff = await firstValueFrom(this.adminStaffApiService.getById(staffId));
      this.staffForm.patchValue({
        fullName: staff.fullName,
        email: staff.email,
        initialPassword: '',
        displayName: staff.displayName,
        phoneNumber: staff.phoneNumber ?? '',
        isActive: staff.isActive,
      });
      this.hasRecord.set(true);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.hasRecord.set(false);
    } finally {
      this.isLoading.set(false);
    }
  }
}

function normalizeRequired(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function optionalUuidValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) {
      return null;
    }
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ? null
      : { uuid: true };
  };
}
