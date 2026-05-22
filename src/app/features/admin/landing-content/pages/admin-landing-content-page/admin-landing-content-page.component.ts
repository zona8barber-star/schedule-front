import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { LandingContentResponse } from '../../../../../core/models/content.models';
import { AdminContentApiService } from '../../../../../core/services/admin-content-api.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

@Component({
  selector: 'app-admin-landing-content-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-landing-content-page.component.html',
  styleUrl: './admin-landing-content-page.component.scss',
})
export class AdminLandingContentPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminContentApiService = inject(AdminContentApiService);

  readonly submitted = signal(false);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
  readonly submitLabel = computed(() => (this.isSubmitting() ? 'Guardando...' : 'Guardar cambios'));

  readonly landingForm = this.formBuilder.group({
    heroTitle: ['', [Validators.required, Validators.maxLength(200)]],
    heroSubtitle: ['', [Validators.maxLength(500)]],
    aboutTitle: ['', [Validators.maxLength(200)]],
    aboutText: ['', [Validators.maxLength(3000)]],
    contactPhone: ['', [Validators.maxLength(120)]],
    mapsUrl: ['', [Validators.maxLength(2000)]],
    address: ['', [Validators.maxLength(400)]],
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.landingForm.invalid) {
      this.landingForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const value = this.landingForm.getRawValue();

    try {
      const response = await firstValueFrom(
        this.adminContentApiService.updateLanding({
          heroTitle: normalizeRequiredText(value.heroTitle),
          heroSubtitle: normalizeOptionalText(value.heroSubtitle),
          aboutTitle: normalizeOptionalText(value.aboutTitle),
          aboutText: normalizeOptionalText(value.aboutText),
          contactPhone: normalizeOptionalText(value.contactPhone),
          mapsUrl: normalizeOptionalText(value.mapsUrl),
          address: normalizeOptionalText(value.address),
        }),
      );

      this.applyToForm(response);
      this.successMessage.set('Contenido de la landing actualizado.');
      this.submitted.set(false);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  showError(controlName: 'heroTitle', errorName: string): boolean {
    const control = this.landingForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.applyToForm(await firstValueFrom(this.adminContentApiService.getLanding()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private applyToForm(content: LandingContentResponse): void {
    this.landingForm.patchValue(
      {
        heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle ?? '',
        aboutTitle: content.aboutTitle ?? '',
        aboutText: content.aboutText ?? '',
        contactPhone: content.contactPhone ?? '',
        mapsUrl: content.mapsUrl ?? '',
        address: content.address ?? '',
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
  return normalized ? normalized : null;
}
