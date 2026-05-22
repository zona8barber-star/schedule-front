import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { BrandingSettingsResponse } from '../../../../../core/models/content.models';
import { AdminContentApiService } from '../../../../../core/services/admin-content-api.service';
import { ThemeService } from '../../../../../core/services/theme.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

@Component({
  selector: 'app-admin-branding-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-branding-page.component.html',
  styleUrl: './admin-branding-page.component.scss',
})
export class AdminBrandingPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminContentApiService = inject(AdminContentApiService);
  private readonly themeService = inject(ThemeService);

  readonly submitted = signal(false);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
  readonly submitLabel = computed(() => (this.isSubmitting() ? 'Guardando...' : 'Guardar cambios'));

  readonly brandingForm = this.formBuilder.group({
    appName: ['', [Validators.required, Validators.maxLength(200)]],
    primaryColor: ['', [Validators.required, hexColorValidator()]],
    secondaryColor: ['', [Validators.required, hexColorValidator()]],
    logoMediaAssetId: ['', [optionalUuidValidator()]],
    appIconMediaAssetId: ['', [optionalUuidValidator()]],
  });

  ngOnInit(): void {
    void this.load();
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.brandingForm.invalid) {
      this.brandingForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const value = this.brandingForm.getRawValue();

    try {
      const response = await firstValueFrom(
        this.adminContentApiService.updateBranding({
          appName: normalizeRequiredText(value.appName),
          primaryColor: normalizeRequiredText(value.primaryColor),
          secondaryColor: normalizeRequiredText(value.secondaryColor),
          logoMediaAssetId: normalizeOptionalText(value.logoMediaAssetId),
          appIconMediaAssetId: normalizeOptionalText(value.appIconMediaAssetId),
        }),
      );

      this.applyToForm(response);
      this.themeService.applyBranding(response);
  this.successMessage.set('Marca actualizada.');
      this.submitted.set(false);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  showError(
    controlName:
      | 'appName'
      | 'primaryColor'
      | 'secondaryColor'
      | 'logoMediaAssetId'
      | 'appIconMediaAssetId',
    errorName: string,
  ): boolean {
    const control = this.brandingForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const branding = await firstValueFrom(this.adminContentApiService.getBranding());
      this.applyToForm(branding);
      this.themeService.applyBranding(branding);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private applyToForm(branding: BrandingSettingsResponse): void {
    this.brandingForm.patchValue(
      {
        appName: branding.appName,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        logoMediaAssetId: branding.logoMediaAssetId ?? '',
        appIconMediaAssetId: branding.appIconMediaAssetId ?? '',
      },
      { emitEvent: false },
    );
  }
}

function normalizeRequiredText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function optionalUuidValidator(): ValidatorFn {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return uuidPattern.test(String(value).trim()) ? null : { uuid: true };
  };
}

function hexColorValidator(): ValidatorFn {
  const colorPattern = /^#[0-9a-fA-F]{6}$/;

  return (control: AbstractControl): ValidationErrors | null => {
    const rawValue = control.value;
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    return colorPattern.test(String(rawValue).trim()) ? null : { hexColor: true };
  };
}
