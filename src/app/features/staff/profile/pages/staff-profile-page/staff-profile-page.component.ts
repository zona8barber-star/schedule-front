import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  StaffProfileUpdateRequest,
  StaffSelfProfileResponse,
} from '../../../../../core/models/staff.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { StaffProfileApiService } from '../../../../../core/services/staff-profile-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

const MAX_FILE_BYTES = 10_485_760; // 10 MB

@Component({
  selector: 'app-staff-profile-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './staff-profile-page.component.html',
  styleUrl: './staff-profile-page.component.scss',
})
export class StaffProfilePageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly staffProfileApiService = inject(StaffProfileApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');
  readonly qrInput = viewChild<ElementRef<HTMLInputElement>>('qrInput');

  readonly submitted = signal(false);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly isSigningOut = signal(false);
  readonly photoUploading = signal(false);
  readonly qrUploading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly photoError = signal<string | null>(null);
  readonly qrError = signal<string | null>(null);
  readonly profile = signal<StaffSelfProfileResponse | null>(null);
  readonly photoPreviewUrl = signal<string | null>(null);
  readonly qrPreviewUrl = signal<string | null>(null);

  readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
  readonly submitLabel = computed(() => (this.isSubmitting() ? 'Guardando...' : 'Guardar cambios'));

  readonly profileForm = this.formBuilder.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    bio: ['', [Validators.maxLength(2000)]],
    phoneNumber: ['', [Validators.maxLength(40)]],
    instagramUrl: ['', [Validators.maxLength(2048)]],
    facebookUrl: ['', [Validators.maxLength(2048)]],
    tikTokUrl: ['', [Validators.maxLength(2048)]],
    youtubeUrl: ['', [Validators.maxLength(2048)]],
    xUrl: ['', [Validators.maxLength(2048)]],
  });

  ngOnInit(): void {
    void this.loadProfile();
    this.destroyRef.onDestroy(() => {
      revokeBlobUrl(this.photoPreviewUrl());
      revokeBlobUrl(this.qrPreviewUrl());
    });
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.profileForm.invalid || !this.profile()) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.profileForm.getRawValue();

    try {
      const updatedProfile = await firstValueFrom(
        this.staffProfileApiService.updateCurrent({
          displayName: normalizeRequired(formValue.displayName),
          bio: normalizeOptional(formValue.bio),
          phoneNumber: normalizeOptional(formValue.phoneNumber),
          defaultAppointmentDurationMinutes: null,
          photoMediaAssetId: this.profile()?.photoMediaAssetId ?? null,
          tipsQrMediaAssetId: this.profile()?.tipsQrMediaAssetId ?? null,
          instagramUrl: normalizeOptional(formValue.instagramUrl),
          facebookUrl: normalizeOptional(formValue.facebookUrl),
          tikTokUrl: normalizeOptional(formValue.tikTokUrl),
          youtubeUrl: normalizeOptional(formValue.youtubeUrl),
          xUrl: normalizeOptional(formValue.xUrl),
        } satisfies StaffProfileUpdateRequest),
      );
      this.profile.set(updatedProfile);
      this.applyProfileToForm(updatedProfile);
      this.successMessage.set('Tu perfil se actualizó correctamente.');
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  showError(
    controlName:
      | 'displayName'
      | 'bio'
      | 'phoneNumber'
      | 'instagramUrl'
      | 'facebookUrl'
      | 'tikTokUrl'
      | 'youtubeUrl'
      | 'xUrl',
    errorName: string,
  ): boolean {
    const control = this.profileForm.controls[controlName];
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
    if (!file) return;
    this.photoError.set(null);
    if (file.size > MAX_FILE_BYTES) {
      this.photoError.set(
        'El archivo no puede superar 10 MB. Si subes uno nuevo reemplazará el actual.',
      );
      resetFileInput(event);
      return;
    }
    if (file.size === 0) {
      this.photoError.set(
        'No pudimos leer el archivo seleccionado. Vuelve a intentarlo o elige la foto desde la galería.',
      );
      resetFileInput(event);
      return;
    }
    this.photoUploading.set(true);
    let preview: string | null = null;
    try {
      const refreshedAccessToken = await this.authService.refreshAccessToken();
      if (!refreshedAccessToken) {
        this.photoError.set('Tu sesión expiró. Inicia sesión nuevamente e intenta subir la foto otra vez.');
        return;
      }

      preview = URL.createObjectURL(file);
      revokeBlobUrl(this.photoPreviewUrl());
      this.photoPreviewUrl.set(preview);

      const updated = await firstValueFrom(this.staffProfileApiService.uploadPhoto(file));
      this.profile.set(updated);
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
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar foto de perfil?',
      message: 'Se eliminará tu foto actual. Podrás subir una nueva cuando quieras.',
    });
    if (!confirmed) return;

    this.photoError.set(null);
    this.photoUploading.set(true);
    revokeBlobUrl(this.photoPreviewUrl());
    this.photoPreviewUrl.set(null);
    try {
      const updated = await firstValueFrom(this.staffProfileApiService.removePhoto());
      this.profile.set(updated);
    } catch (error) {
      this.photoError.set(getApiErrorMessage(error));
    } finally {
      this.photoUploading.set(false);
    }
  }

  async onQrSelected(event: Event): Promise<void> {
    const file = getFileFromEvent(event);
    if (!file) return;
    this.qrError.set(null);
    if (file.size > MAX_FILE_BYTES) {
      this.qrError.set(
        'El archivo no puede superar 10 MB. Si subes uno nuevo reemplazará el actual.',
      );
      resetFileInput(event);
      return;
    }
    if (file.size === 0) {
      this.qrError.set(
        'No pudimos leer el archivo seleccionado. Vuelve a intentarlo o elige otra imagen.',
      );
      resetFileInput(event);
      return;
    }
    this.qrUploading.set(true);
    let preview: string | null = null;
    try {
      const refreshedAccessToken = await this.authService.refreshAccessToken();
      if (!refreshedAccessToken) {
        this.qrError.set('Tu sesión expiró. Inicia sesión nuevamente e intenta subir el archivo otra vez.');
        return;
      }

      preview = URL.createObjectURL(file);
      revokeBlobUrl(this.qrPreviewUrl());
      this.qrPreviewUrl.set(preview);

      const updated = await firstValueFrom(this.staffProfileApiService.uploadTipsQr(file));
      this.profile.set(updated);
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
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar QR de propinas?',
      message: 'Se eliminará el QR actual. Podrás subir uno nuevo cuando quieras.',
    });
    if (!confirmed) return;

    this.qrError.set(null);
    this.qrUploading.set(true);
    revokeBlobUrl(this.qrPreviewUrl());
    this.qrPreviewUrl.set(null);
    try {
      const updated = await firstValueFrom(this.staffProfileApiService.removeTipsQr());
      this.profile.set(updated);
    } catch (error) {
      this.qrError.set(getApiErrorMessage(error));
    } finally {
      this.qrUploading.set(false);
    }
  }

  async logout(): Promise<void> {
    this.isSigningOut.set(true);
    try {
      await this.authService.logout();
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } finally {
      this.isSigningOut.set(false);
    }
  }

  private async loadProfile(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const profile = await firstValueFrom(this.staffProfileApiService.getCurrent());
      this.profile.set(profile);
      this.applyProfileToForm(profile);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.profile.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  private applyProfileToForm(profile: StaffSelfProfileResponse): void {
    this.profileForm.patchValue({
      displayName: profile.displayName,
      bio: profile.bio ?? '',
      phoneNumber: profile.phoneNumber ?? '',
      instagramUrl: profile.instagramUrl ?? '',
      facebookUrl: profile.facebookUrl ?? '',
      tikTokUrl: profile.tikTokUrl ?? '',
      youtubeUrl: profile.youtubeUrl ?? '',
      xUrl: profile.xUrl ?? '',
    });
  }
}

function normalizeRequired(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptional(value: string | null | undefined): string | null {
  const v = value?.trim() ?? '';
  return v || null;
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
