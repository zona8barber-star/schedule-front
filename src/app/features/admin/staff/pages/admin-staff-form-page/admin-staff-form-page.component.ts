import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { STAFF_DURATION_RANGE, StaffResponse } from '../../../../../core/models/staff.models';
import { AdminStaffApiService } from '../../../../../core/services/admin-staff-api.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

const MAX_FILE_BYTES = 10_485_760; // 10 MB

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
  private readonly authService = inject(AuthService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');
  readonly qrInput = viewChild<ElementRef<HTMLInputElement>>('qrInput');

  readonly durationRange = STAFF_DURATION_RANGE;
  readonly submitted = signal(false);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly staffId = signal<string | null>(this.route.snapshot.paramMap.get('staffId'));
  readonly hasRecord = signal(!this.route.snapshot.paramMap.get('staffId'));
  readonly isEditMode = computed(() => this.staffId() !== null);
  readonly staff = signal<StaffResponse | null>(null);
  readonly photoUploading = signal(false);
  readonly qrUploading = signal(false);
  readonly photoError = signal<string | null>(null);
  readonly qrError = signal<string | null>(null);
  readonly photoPreviewUrl = signal<string | null>(null);
  readonly qrPreviewUrl = signal<string | null>(null);

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
            photoMediaAssetId: this.staff()?.photoMediaAssetId ?? null,
            tipsQrMediaAssetId: this.staff()?.tipsQrMediaAssetId ?? null,
            isActive: formValue.isActive ?? true,
          }),
        );

        this.staff.set(updated);
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
            photoMediaAssetId: null,
            tipsQrMediaAssetId: null,
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
      | 'defaultAppointmentDurationMinutes',
    errorName: string,
  ): boolean {
    const control = this.staffForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }

  triggerPhotoInput(): void {
    this.photoInput()?.nativeElement.click();
  }

  triggerQrInput(): void {
    this.qrInput()?.nativeElement.click();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const file = getFileFromEvent(event);
    if (!file || !this.staffId()) return;
    this.photoError.set(null);
    if (file.size > MAX_FILE_BYTES) {
      this.photoError.set('El archivo no puede superar 10 MB. Si subes uno nuevo reemplazara el actual.');
      resetFileInput(event);
      return;
    }
    if (file.size === 0) {
      this.photoError.set('No pudimos leer el archivo seleccionado. Intenta de nuevo.');
      resetFileInput(event);
      return;
    }

    this.photoUploading.set(true);
    let preview: string | null = null;
    try {
      const refreshedAccessToken = await this.authService.refreshAccessToken();
      if (!refreshedAccessToken) {
        this.photoError.set('Tu sesion expiro. Inicia sesion nuevamente e intenta subir la foto otra vez.');
        return;
      }

      preview = URL.createObjectURL(file);
      revokeBlobUrl(this.photoPreviewUrl());
      this.photoPreviewUrl.set(preview);

      const updated = await firstValueFrom(
        this.adminStaffApiService.uploadPhoto(this.staffId()!, file),
      );
      this.staff.set(updated);
      revokeBlobUrl(preview);
      this.photoPreviewUrl.set(null);
    } catch (error) {
      this.photoError.set(getApiErrorMessage(error));
      revokeBlobUrl(preview);
      this.photoPreviewUrl.set(null);
    } finally {
      this.photoUploading.set(false);
      resetFileInput(event);
    }
  }

  async removePhoto(): Promise<void> {
    if (!this.staffId()) return;
    const confirmed = await this.confirmModal.confirm({
      title: 'Eliminar foto de perfil?',
      message: 'Se eliminara la foto actual de este profesional.',
    });
    if (!confirmed) return;

    this.photoError.set(null);
    this.photoUploading.set(true);
    revokeBlobUrl(this.photoPreviewUrl());
    this.photoPreviewUrl.set(null);
    try {
      const updated = await firstValueFrom(this.adminStaffApiService.removePhoto(this.staffId()!));
      this.staff.set(updated);
    } catch (error) {
      this.photoError.set(getApiErrorMessage(error));
    } finally {
      this.photoUploading.set(false);
    }
  }

  async onQrSelected(event: Event): Promise<void> {
    const file = getFileFromEvent(event);
    if (!file || !this.staffId()) return;
    this.qrError.set(null);
    if (file.size > MAX_FILE_BYTES) {
      this.qrError.set('El archivo no puede superar 10 MB. Si subes uno nuevo reemplazara el actual.');
      resetFileInput(event);
      return;
    }
    if (file.size === 0) {
      this.qrError.set('No pudimos leer el archivo seleccionado. Intenta de nuevo.');
      resetFileInput(event);
      return;
    }

    this.qrUploading.set(true);
    let preview: string | null = null;
    try {
      const refreshedAccessToken = await this.authService.refreshAccessToken();
      if (!refreshedAccessToken) {
        this.qrError.set('Tu sesion expiro. Inicia sesion nuevamente e intenta subir el archivo otra vez.');
        return;
      }

      preview = URL.createObjectURL(file);
      revokeBlobUrl(this.qrPreviewUrl());
      this.qrPreviewUrl.set(preview);

      const updated = await firstValueFrom(
        this.adminStaffApiService.uploadTipsQr(this.staffId()!, file),
      );
      this.staff.set(updated);
      revokeBlobUrl(preview);
      this.qrPreviewUrl.set(null);
    } catch (error) {
      this.qrError.set(getApiErrorMessage(error));
      revokeBlobUrl(preview);
      this.qrPreviewUrl.set(null);
    } finally {
      this.qrUploading.set(false);
      resetFileInput(event);
    }
  }

  async removeQr(): Promise<void> {
    if (!this.staffId()) return;
    const confirmed = await this.confirmModal.confirm({
      title: 'Eliminar QR de propinas?',
      message: 'Se eliminara el QR actual de este profesional.',
    });
    if (!confirmed) return;

    this.qrError.set(null);
    this.qrUploading.set(true);
    revokeBlobUrl(this.qrPreviewUrl());
    this.qrPreviewUrl.set(null);
    try {
      const updated = await firstValueFrom(this.adminStaffApiService.removeTipsQr(this.staffId()!));
      this.staff.set(updated);
    } catch (error) {
      this.qrError.set(getApiErrorMessage(error));
    } finally {
      this.qrUploading.set(false);
    }
  }

  private async loadStaff(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const staff = await firstValueFrom(this.adminStaffApiService.getById(this.staffId()!));
      this.staff.set(staff);
      this.applyStaffToForm(staff);
      this.hasRecord.set(true);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.hasRecord.set(false);
    } finally {
      this.isLoading.set(false);
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

function getFileFromEvent(event: Event): File | null {
  const input = event.target as HTMLInputElement;
  return input.files?.[0] ?? null;
}

function resetFileInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  input.value = '';
}

function revokeBlobUrl(url: string | null): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
