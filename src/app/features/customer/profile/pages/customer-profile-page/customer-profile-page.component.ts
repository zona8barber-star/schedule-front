import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { CustomerProfileResponse } from '../../../../../core/models/customer-profile.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { CustomerProfileApiService } from '../../../../../core/services/customer-profile-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

const MAX_FILE_BYTES = 10_485_760; // 10 MB

type ProfileTab = 'info' | 'password';

@Component({
  selector: 'app-customer-profile-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './customer-profile-page.component.html',
  styleUrl: './customer-profile-page.component.scss',
})
export class CustomerProfilePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profileApiService = inject(CustomerProfileApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');

  readonly activeTab = signal<ProfileTab>('info');
  readonly profile = signal<CustomerProfileResponse | null>(null);
  readonly isLoading = signal(true);
  readonly photoPreviewUrl = signal<string | null>(null);

  readonly infoSubmitted = signal(false);
  readonly isInfoSaving = signal(false);
  readonly photoUploading = signal(false);

  readonly pwdSubmitted = signal(false);
  readonly isPwdSaving = signal(false);
  readonly isSigningOut = signal(false);

  readonly photoError = signal<string | null>(null);
  readonly infoError = signal<string | null>(null);
  readonly infoSuccess = signal<string | null>(null);
  readonly pwdError = signal<string | null>(null);
  readonly pwdSuccess = signal<string | null>(null);

  readonly isBusy = computed(() => this.isInfoSaving() || this.photoUploading() || this.isPwdSaving());

  readonly infoForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phoneNumber: ['', [Validators.maxLength(40)]],
    dateOfBirth: [''],
  });

  readonly pwdForm = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(256)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    void this.loadProfile();
    this.destroyRef.onDestroy(() => {
      const url = this.photoPreviewUrl();
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }

  async saveInfo(): Promise<void> {
    this.infoSubmitted.set(true);
    this.infoError.set(null);
    this.infoSuccess.set(null);

    if (this.infoForm.invalid) {
      this.infoForm.markAllAsTouched();
      return;
    }

    this.isInfoSaving.set(true);
    const { fullName, phoneNumber, dateOfBirth } = this.infoForm.getRawValue();

    try {
      const updated = await firstValueFrom(
        this.profileApiService.update({
          fullName: fullName?.trim() ?? '',
          phoneNumber: phoneNumber?.trim() || null,
          dateOfBirth: dateOfBirth?.trim() || null,
        }),
      );
      this.profile.set(updated);
      this.applyToForm(updated);
      this.infoSuccess.set('Tu información fue actualizada correctamente.');
    } catch (error) {
      this.infoError.set(getApiErrorMessage(error));
    } finally {
      this.isInfoSaving.set(false);
    }
  }

  showInfoError(field: 'fullName' | 'phoneNumber' | 'dateOfBirth', errorName: string): boolean {
    const c = this.infoForm.controls[field];
    return c.hasError(errorName) && (c.touched || this.infoSubmitted());
  }

  triggerPhotoInput(): void {
    this.photoInput()?.nativeElement.click();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    this.photoError.set(null);
    if (file.size > MAX_FILE_BYTES) {
      this.photoError.set('La foto no puede superar 10 MB.');
      input.value = '';
      return;
    }

    if (file.size === 0) {
      this.photoError.set(
        'No pudimos leer el archivo seleccionado. Vuelve a intentarlo o elige la foto desde la galería.',
      );
      input.value = '';
      return;
    }

    const preview = URL.createObjectURL(file);
    const current = this.photoPreviewUrl();
    if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
    this.photoPreviewUrl.set(preview);
    this.photoUploading.set(true);

    try {
      const updated = await firstValueFrom(this.profileApiService.uploadPhoto(file));
      this.profile.set(updated);
      const prev = this.photoPreviewUrl();
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      this.photoPreviewUrl.set(null);
    } catch (error) {
      this.photoError.set(getApiErrorMessage(error));
      const prev = this.photoPreviewUrl();
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      this.photoPreviewUrl.set(null);
    } finally {
      this.photoUploading.set(false);
      input.value = '';
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
    const current = this.photoPreviewUrl();
    if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
    this.photoPreviewUrl.set(null);

    try {
      const updated = await firstValueFrom(this.profileApiService.removePhoto());
      this.profile.set(updated);
    } catch (error) {
      this.photoError.set(getApiErrorMessage(error));
    } finally {
      this.photoUploading.set(false);
    }
  }

  async changePassword(): Promise<void> {
    this.pwdSubmitted.set(true);
    this.pwdError.set(null);
    this.pwdSuccess.set(null);

    if (this.pwdForm.invalid) {
      this.pwdForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.pwdForm.getRawValue();

    if (newPassword !== confirmPassword) {
      this.pwdError.set('Las contraseñas no coinciden.');
      return;
    }

    this.isPwdSaving.set(true);

    try {
      await firstValueFrom(
        this.profileApiService.changePassword({
          currentPassword: currentPassword ?? '',
          newPassword: newPassword ?? '',
        }),
      );
      this.pwdForm.reset();
      this.pwdSubmitted.set(false);
      this.pwdSuccess.set('Tu contraseña fue actualizada correctamente.');
    } catch (error) {
      this.pwdError.set(getApiErrorMessage(error));
    } finally {
      this.isPwdSaving.set(false);
    }
  }

  showPwdError(field: 'currentPassword' | 'newPassword' | 'confirmPassword', errorName: string): boolean {
    const c = this.pwdForm.controls[field];
    return c.hasError(errorName) && (c.touched || this.pwdSubmitted());
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
    try {
      const data = await firstValueFrom(this.profileApiService.get());
      this.profile.set(data);
      this.applyToForm(data);
    } catch (error) {
      this.infoError.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private applyToForm(data: CustomerProfileResponse): void {
    this.infoForm.patchValue({
      fullName: data.fullName,
      phoneNumber: data.phoneNumber ?? '',
      dateOfBirth: data.dateOfBirth ?? '',
    });
  }
}
