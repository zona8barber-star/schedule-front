import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  AvailabilitySummary,
  STAFF_AVAILABILITY_DAYS,
} from '../../../../../core/models/availability.models';
import { STAFF_DURATION_RANGE, StaffResponse } from '../../../../../core/models/staff.models';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

@Component({
  selector: 'app-admin-staff-form-page',
  imports: [ReactiveFormsModule, RouterLink, ApiFeedbackComponent],
  templateUrl: './admin-staff-form-page.component.html',
  styleUrl: './admin-staff-form-page.component.scss',
})
export class AdminStaffFormPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminStaffApiService = inject(AdminStaffApiService);

  readonly durationRange = STAFF_DURATION_RANGE;
  readonly submitted = signal(false);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly staffId = signal<string | null>(this.route.snapshot.paramMap.get('staffId'));
  readonly hasRecord = signal(!this.route.snapshot.paramMap.get('staffId'));
  readonly isEditMode = computed(() => this.staffId() !== null);
  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'Editar profesional' : 'Crear profesional',
  );
  readonly submitLabel = computed(() => {
    if (this.isSubmitting()) {
      return this.isEditMode() ? 'Guardando...' : 'Creando...';
    }

    return this.isEditMode() ? 'Guardar cambios' : 'Crear profesional';
  });
  readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
  readonly availability = signal<AvailabilitySummary | null>(null);
  readonly availabilityLoading = signal(false);
  readonly scheduleByDay = computed(() => {
    const summary = this.availability();
    if (!summary) return [];

    return STAFF_AVAILABILITY_DAYS.map((day) => ({
      label: day.label,
      ranges: summary.rules
        .filter((rule) => rule.dayOfWeek === day.dayOfWeek && rule.isActive)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((rule) => `${rule.startTime.slice(0, 5)}–${rule.endTime.slice(0, 5)}`),
    }));
  });

  readonly staffForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    initialPassword: ['', [Validators.minLength(8), Validators.maxLength(128)]],
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phoneNumber: ['', [Validators.maxLength(40)]],
    bio: ['', [Validators.maxLength(2000)]],
    defaultAppointmentDurationMinutes: [Number(STAFF_DURATION_RANGE.suggested), [
      Validators.required,
      Validators.min(STAFF_DURATION_RANGE.min),
      Validators.max(STAFF_DURATION_RANGE.max),
    ]],
    photoMediaAssetId: ['', [optionalUuidValidator()]],
    tipsQrMediaAssetId: ['', [optionalUuidValidator()]],
    isActive: [true],
  });

  constructor() {
    if (this.isEditMode()) {
      void this.loadStaff();
    } else {
      this.staffForm.controls.initialPassword.addValidators(Validators.required);
      this.staffForm.controls.initialPassword.updateValueAndValidity({ emitEvent: false });
    }
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.staffForm.invalid || (this.isEditMode() && !this.hasRecord())) {
      this.staffForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.staffForm.getRawValue();

    try {
      if (this.isEditMode() && this.staffId()) {
        const updated = await firstValueFrom(
          this.adminStaffApiService.update(this.staffId()!, {
            fullName: normalizeRequiredText(formValue.fullName),
            email: normalizeRequiredText(formValue.email),
            displayName: normalizeRequiredText(formValue.displayName),
            phoneNumber: normalizeOptionalText(formValue.phoneNumber),
            bio: normalizeOptionalText(formValue.bio),
            defaultAppointmentDurationMinutes: formValue.defaultAppointmentDurationMinutes,
            photoMediaAssetId: normalizeOptionalText(formValue.photoMediaAssetId),
            tipsQrMediaAssetId: normalizeOptionalText(formValue.tipsQrMediaAssetId),
            isActive: formValue.isActive ?? true,
          }),
        );

        this.applyStaffToForm(updated);
        this.successMessage.set('Perfil profesional actualizado correctamente.');
      } else {
        const created = await firstValueFrom(
          this.adminStaffApiService.create({
            fullName: normalizeRequiredText(formValue.fullName),
            email: normalizeRequiredText(formValue.email),
            displayName: normalizeRequiredText(formValue.displayName),
            initialPassword: normalizeRequiredText(formValue.initialPassword),
            phoneNumber: normalizeOptionalText(formValue.phoneNumber),
            bio: normalizeOptionalText(formValue.bio),
            defaultAppointmentDurationMinutes: formValue.defaultAppointmentDurationMinutes,
            photoMediaAssetId: normalizeOptionalText(formValue.photoMediaAssetId),
            tipsQrMediaAssetId: normalizeOptionalText(formValue.tipsQrMediaAssetId),
            isActive: formValue.isActive ?? true,
          }),
        );

        await this.router.navigate(['/admin/staff', created.staffProfileId, 'edit'], {
          replaceUrl: true,
        });
      }
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  showError(
    controlName:
      | 'fullName'
      | 'email'
      | 'initialPassword'
      | 'displayName'
      | 'phoneNumber'
      | 'bio'
      | 'defaultAppointmentDurationMinutes'
      | 'photoMediaAssetId'
      | 'tipsQrMediaAssetId',
    errorName: string,
  ): boolean {
    const control = this.staffForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }

  private async loadStaff(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const staff = await firstValueFrom(this.adminStaffApiService.getById(this.staffId()!));
      this.applyStaffToForm(staff);
      this.hasRecord.set(true);
      void this.loadAvailability();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.hasRecord.set(false);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadAvailability(): Promise<void> {
    this.availabilityLoading.set(true);
    try {
      const availability = await firstValueFrom(
        this.adminStaffApiService.getAvailability(this.staffId()!),
      );
      this.availability.set(availability);
    } catch {
      // El horario es informativo; si falla no debe bloquear la edicion del perfil.
      this.availability.set(null);
    } finally {
      this.availabilityLoading.set(false);
    }
  }

  private applyStaffToForm(staff: StaffResponse): void {
    this.staffForm.patchValue({
      fullName: staff.fullName,
      email: staff.email,
      initialPassword: '',
      displayName: staff.displayName,
      phoneNumber: staff.phoneNumber ?? '',
      bio: staff.bio ?? '',
      defaultAppointmentDurationMinutes: staff.defaultAppointmentDurationMinutes,
      photoMediaAssetId: staff.photoMediaAssetId ?? '',
      tipsQrMediaAssetId: staff.tipsQrMediaAssetId ?? '',
      isActive: staff.isActive,
    });
  }
}

function normalizeRequiredText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue ? normalizedValue : null;
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
