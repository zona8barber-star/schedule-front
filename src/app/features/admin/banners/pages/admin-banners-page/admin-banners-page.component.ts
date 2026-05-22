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

import {
  BannerResponse,
  CreateBannerRequest,
  UpdateBannerRequest,
} from '../../../../../core/models/content.models';
import { AdminContentApiService } from '../../../../../core/services/admin-content-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

@Component({
  selector: 'app-admin-banners-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-banners-page.component.html',
  styleUrl: './admin-banners-page.component.scss',
})
export class AdminBannersPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminContentApiService = inject(AdminContentApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  readonly submitted = signal(false);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly deletingBannerId = signal<string | null>(null);
  readonly editingBannerId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly banners = signal<BannerResponse[]>([]);

  readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
  readonly submitLabel = computed(() => {
    if (this.isSubmitting()) {
      return this.editingBannerId() ? 'Guardando...' : 'Creando...';
    }

    return this.editingBannerId() ? 'Guardar banner' : 'Crear banner';
  });

  readonly bannerForm = this.formBuilder.group(
    {
      title: ['', [Validators.required, Validators.maxLength(200)]],
      subtitle: ['', [Validators.maxLength(500)]],
      imageMediaAssetId: ['', [optionalUuidValidator()]],
      linkUrl: ['', [optionalUrlValidator()]],
      sortOrder: [0, [Validators.required]],
      isActive: [true],
      startsAtUtc: [''],
      endsAtUtc: [''],
    },
    { validators: [dateRangeValidator()] },
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.bannerForm.invalid) {
      this.bannerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    try {
      const payload = this.buildPayload();
      const editingBannerId = this.editingBannerId();

      if (editingBannerId) {
        await firstValueFrom(
          this.adminContentApiService.updateBanner(editingBannerId, payload as UpdateBannerRequest),
        );
        this.successMessage.set('Banner actualizado.');
      } else {
        await firstValueFrom(
          this.adminContentApiService.createBanner(payload as CreateBannerRequest),
        );
        this.successMessage.set('Banner creado.');
      }

      this.resetForm();
      await this.load();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  startEdit(banner: BannerResponse): void {
    this.editingBannerId.set(banner.id);
    this.submitted.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.bannerForm.patchValue(
      {
        title: banner.title,
        subtitle: banner.subtitle ?? '',
        imageMediaAssetId: banner.imageMediaAssetId ?? '',
        linkUrl: banner.linkUrl ?? '',
        sortOrder: banner.sortOrder,
        isActive: banner.isActive,
        startsAtUtc: toDateTimeLocalInput(banner.startsAtUtc),
        endsAtUtc: toDateTimeLocalInput(banner.endsAtUtc),
      },
      { emitEvent: false },
    );
  }

  resetForm(): void {
    this.editingBannerId.set(null);
    this.submitted.set(false);
    this.bannerForm.reset(
      {
        title: '',
        subtitle: '',
        imageMediaAssetId: '',
        linkUrl: '',
        sortOrder: 0,
        isActive: true,
        startsAtUtc: '',
        endsAtUtc: '',
      },
      { emitEvent: false },
    );
  }

  async deleteBanner(banner: BannerResponse): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar banner?',
      message: `Se eliminará "${banner.title}" de forma permanente.`,
    });
    if (!confirmed) return;

    this.deletingBannerId.set(banner.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(this.adminContentApiService.deleteBanner(banner.id));
      this.successMessage.set('Banner eliminado.');

      if (this.editingBannerId() === banner.id) {
        this.resetForm();
      }

      await this.load();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.deletingBannerId.set(null);
    }
  }

  showError(
    controlName: 'title' | 'sortOrder' | 'imageMediaAssetId' | 'linkUrl',
    errorName: string,
  ): boolean {
    const control = this.bannerForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }

  showFormError(errorName: string): boolean {
    return this.bannerForm.hasError(errorName) && (this.bannerForm.touched || this.submitted());
  }

  formatDateTime(value: string | null): string {
    if (!value) {
      return 'No definido';
    }

    return this.dateTimeFormatter.format(new Date(value));
  }

  private buildPayload(): CreateBannerRequest {
    const value = this.bannerForm.getRawValue();

    return {
      title: normalizeRequiredText(value.title),
      subtitle: normalizeOptionalText(value.subtitle),
      imageMediaAssetId: normalizeOptionalText(value.imageMediaAssetId),
      linkUrl: normalizeOptionalText(value.linkUrl),
      sortOrder: Number(value.sortOrder ?? 0),
      isActive: !!value.isActive,
      startsAtUtc: normalizeDateTime(value.startsAtUtc),
      endsAtUtc: normalizeDateTime(value.endsAtUtc),
    };
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const banners = await firstValueFrom(this.adminContentApiService.listBanners());
      this.banners.set(
        banners
          .slice()
          .sort(
            (first, second) =>
              first.sortOrder - second.sortOrder ||
              first.createdAtUtc.localeCompare(second.createdAtUtc),
          ),
      );
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.banners.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }
}

function normalizeRequiredText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeDateTime(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? new Date(normalized).toISOString() : null;
}

function toDateTimeLocalInput(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  const localDate = new Date(date.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 16);
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

function optionalUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }

    try {
      const url = new URL(String(value).trim());
      return url.protocol === 'http:' || url.protocol === 'https:' ? null : { url: true };
    } catch {
      return { url: true };
    }
  };
}

function dateRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const startsAtUtc = control.get('startsAtUtc')?.value as string | undefined;
    const endsAtUtc = control.get('endsAtUtc')?.value as string | undefined;

    if (!startsAtUtc || !endsAtUtc) {
      return null;
    }

    return new Date(endsAtUtc).getTime() > new Date(startsAtUtc).getTime()
      ? null
      : { dateRange: true };
  };
}
