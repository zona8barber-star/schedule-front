import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';

import { MediaPurpose, MediaPurposeOption } from '../../../core/models/media.models';

export interface FileUploadRequest {
  file: File;
  purpose: MediaPurpose;
}

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
})
export class FileUploadComponent implements OnChanges {
  @Input() title = 'Cargar archivo';
  @Input() description = '';
  @Input() buttonLabel = 'Subir archivo';
  @Input() accept = '';
  @Input() isSubmitting = false;
  @Input() isDisabled = false;
  @Input() maxSizeBytes: number | null = null;
  @Input() purposes: readonly MediaPurposeOption[] = [];

  @Output() readonly uploadRequested = new EventEmitter<FileUploadRequest>();

  readonly selectedFile = signal<File | null>(null);
  readonly selectedPurpose = signal<MediaPurpose | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly fileSizeLabel = computed(() => {
    const file = this.selectedFile();
    return file ? formatBytes(file.size) : '';
  });

  readonly fileInputId = `file-upload-input-${Math.random().toString(36).slice(2, 8)}`;
  readonly purposeSelectId = `file-upload-purpose-${Math.random().toString(36).slice(2, 8)}`;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['purposes'] && !this.selectedPurpose() && this.purposes.length > 0) {
      const firstPurpose = this.purposes.at(0);
      if (firstPurpose) {
        this.selectedPurpose.set(firstPurpose.value);
      }
    }
  }

  selectedPurposeHint(): string | null {
    const selectedPurpose = this.selectedPurpose();
    if (!selectedPurpose) {
      return null;
    }

    return (
      this.purposes.find((purposeOption) => purposeOption.value === selectedPurpose)?.hint ?? null
    );
  }

  isSubmitDisabled(): boolean {
    return this.isDisabled || this.isSubmitting || !this.selectedFile() || !this.selectedPurpose();
  }

  onPurposeChanged(rawValue: string): void {
    if (!rawValue) {
      this.selectedPurpose.set(null);
      return;
    }

    this.selectedPurpose.set(rawValue as MediaPurpose);
  }

  onFileChanged(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;

    this.errorMessage.set(null);
    this.selectedFile.set(file);

    if (!file) {
      return;
    }

    if (!isAcceptedFileType(file, this.accept)) {
      this.errorMessage.set('El tipo de archivo seleccionado no esta permitido.');
      this.selectedFile.set(null);
      input.value = '';
      return;
    }

    if (this.maxSizeBytes === null || file.size <= this.maxSizeBytes) {
      return;
    }

    this.errorMessage.set(
      `El archivo supera el tamano maximo permitido (${formatBytes(this.maxSizeBytes)}).`,
    );
    this.selectedFile.set(null);
    input.value = '';
  }

  submit(): void {
    if (this.isDisabled) {
      return;
    }

    const file = this.selectedFile();
    const purpose = this.selectedPurpose();

    if (!file) {
      this.errorMessage.set('Selecciona un archivo antes de subir.');
      return;
    }

    if (!purpose) {
      this.errorMessage.set('Selecciona una categoria para el archivo.');
      return;
    }

    this.errorMessage.set(null);
    this.uploadRequested.emit({
      file,
      purpose,
    });
  }
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFileType(file: File, accept: string): boolean {
  const trimmedAccept = accept.trim();
  if (!trimmedAccept) {
    return true;
  }

  const acceptedValues = trimmedAccept
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (acceptedValues.length === 0) {
    return true;
  }

  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  return acceptedValues.some((acceptedValue) => {
    if (acceptedValue.endsWith('/*')) {
      const prefix = acceptedValue.slice(0, -1);
      return fileType.startsWith(prefix);
    }

    if (acceptedValue.startsWith('.')) {
      return fileName.endsWith(acceptedValue);
    }

    return fileType === acceptedValue;
  });
}
