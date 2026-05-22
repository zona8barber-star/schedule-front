import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  MEDIA_PURPOSE_OPTIONS,
  MEDIA_STATUS,
  MediaAssetView,
  MediaPurpose,
  MediaStatus,
} from '../../../../core/models/media.models';
import { AdminMediaApiService } from '../../../../core/services/admin-media-api.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../shared/components/api-feedback/api-feedback.component';
import {
  FileUploadComponent,
  FileUploadRequest,
} from '../../../../shared/components/file-upload/file-upload.component';
import { PageStateComponent } from '../../../../shared/components/page-state/page-state.component';

const allFilterValue = 'ALL' as const;
type MediaPurposeFilter = MediaPurpose | typeof allFilterValue;
type MediaStatusFilter = MediaStatus | typeof allFilterValue;

@Component({
  selector: 'app-admin-media-manager-page',
  imports: [RouterLink, ApiFeedbackComponent, FileUploadComponent, PageStateComponent],
  templateUrl: './admin-media-manager-page.component.html',
  styleUrl: './admin-media-manager-page.component.scss',
})
export class AdminMediaManagerPageComponent implements OnInit {
  private readonly adminMediaApiService = inject(AdminMediaApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  readonly mediaStatus = MEDIA_STATUS;
  readonly mediaPurposeOptions = MEDIA_PURPOSE_OPTIONS;
  readonly mediaStatusOptions: readonly { value: MediaStatus; label: string }[] = [
    { value: MEDIA_STATUS.pending, label: 'Pendiente' },
    { value: MEDIA_STATUS.ready, label: 'Listo' },
    { value: MEDIA_STATUS.archived, label: 'Archivado' },
    { value: MEDIA_STATUS.failed, label: 'Fallido' },
  ] as const;
  readonly maxUploadSizeBytes = 5 * 1024 * 1024;
  readonly allowedFileAccept = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

  readonly assets = signal<MediaAssetView[]>([]);
  readonly isLoading = signal(true);
  readonly isUploading = signal(false);
  readonly deletingAssetId = signal<string | null>(null);
  readonly purposeFilter = signal<MediaPurposeFilter>(allFilterValue);
  readonly statusFilter = signal<MediaStatusFilter>(allFilterValue);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly filteredAssets = computed(() => {
    const purposeFilter = this.purposeFilter();
    const statusFilter = this.statusFilter();

    return this.assets()
      .filter((asset) => purposeFilter === allFilterValue || asset.purpose === purposeFilter)
      .filter((asset) => statusFilter === allFilterValue || asset.status === statusFilter);
  });

  ngOnInit(): void {
    void this.loadAssets();
  }

  async uploadAsset(request: FileUploadRequest): Promise<void> {
    this.isUploading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(this.adminMediaApiService.upload(request.file, request.purpose));
      await this.loadAssets();
      this.successMessage.set('El archivo se subio correctamente y ya esta en la biblioteca.');
    } catch (error) {
      this.errorMessage.set(getMediaUploadErrorMessage(error));
    } finally {
      this.isUploading.set(false);
    }
  }

  async archiveAsset(asset: MediaAssetView): Promise<void> {
    if (asset.status === MEDIA_STATUS.archived) {
      return;
    }

    const confirmed = await this.confirmModal.confirm({
      title: '¿Archivar archivo?',
      message: `"${asset.fileName}" se marcará como archivado y dejará de estar disponible.`,
    });
    if (!confirmed) return;

    this.deletingAssetId.set(asset.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(this.adminMediaApiService.delete(asset.id));
      await this.loadAssets();
      this.successMessage.set('El archivo fue archivado correctamente.');
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.deletingAssetId.set(null);
    }
  }

  setPurposeFilter(rawValue: string): void {
    if (rawValue === allFilterValue) {
      this.purposeFilter.set(allFilterValue);
      return;
    }

    const isPurposeValue = this.mediaPurposeOptions.some(
      (purposeOption) => purposeOption.value === rawValue,
    );
    this.purposeFilter.set(isPurposeValue ? (rawValue as MediaPurpose) : allFilterValue);
  }

  setStatusFilter(rawValue: string): void {
    if (rawValue === allFilterValue) {
      this.statusFilter.set(allFilterValue);
      return;
    }

    const isStatusValue = this.mediaStatusOptions.some(
      (statusOption) => statusOption.value === rawValue,
    );
    this.statusFilter.set(isStatusValue ? (rawValue as MediaStatus) : allFilterValue);
  }

  statusLabel(status: MediaStatus): string {
    switch (status) {
      case MEDIA_STATUS.pending:
        return 'Pendiente';
      case MEDIA_STATUS.ready:
        return 'Listo';
      case MEDIA_STATUS.archived:
        return 'Archivado';
      case MEDIA_STATUS.failed:
        return 'Fallido';
      default:
        return status;
    }
  }

  purposeLabel(purpose: MediaPurpose): string {
    return (
      this.mediaPurposeOptions.find((purposeOption) => purposeOption.value === purpose)?.label ??
      purpose
    );
  }

  formatBytes(value: number): string {
    if (value < 1024) {
      return `${value} B`;
    }

    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDateTime(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  private async loadAssets(): Promise<void> {
    this.isLoading.set(true);

    try {
      const assets = await firstValueFrom(this.adminMediaApiService.list());
      this.assets.set(
        [...assets].sort((left, right) => right.createdAtUtc.localeCompare(left.createdAtUtc)),
      );
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.assets.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getMediaUploadErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 413) {
      return 'El archivo supera el tamano maximo permitido de 5 MB.';
    }

    if (error.status === 503) {
      return 'El servicio de archivos no esta disponible temporalmente. Intenta nuevamente.';
    }

    if (error.status === 422) {
      return getApiErrorMessage(
        error,
        'Archivo invalido. Usa JPG, PNG, WEBP, GIF o PDF y verifica el tamano maximo de 5 MB.',
      );
    }
  }

  return getApiErrorMessage(error);
}
