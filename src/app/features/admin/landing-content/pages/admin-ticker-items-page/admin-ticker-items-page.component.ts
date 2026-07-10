import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  CreateTickerItemRequest,
  TickerItemResponse,
  UpdateTickerItemRequest,
} from '../../../../../core/models/content.models';
import { AdminContentApiService } from '../../../../../core/services/admin-content-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PageStateComponent } from '../../../../../shared/components/page-state/page-state.component';

@Component({
  selector: 'app-admin-ticker-items-page',
  imports: [ReactiveFormsModule, ApiFeedbackComponent, PageStateComponent],
  templateUrl: './admin-ticker-items-page.component.html',
  styleUrl: './admin-ticker-items-page.component.scss',
})
export class AdminTickerItemsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminContentApiService = inject(AdminContentApiService);
  private readonly confirmModal = inject(ConfirmModalService);

  readonly submitted = signal(false);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly deletingItemId = signal<string | null>(null);
  readonly editingItemId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly tickerItems = signal<TickerItemResponse[]>([]);

  readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
  readonly submitLabel = computed(() => {
    if (this.isSubmitting()) {
      return this.editingItemId() ? 'Guardando...' : 'Creando...';
    }

    return this.editingItemId() ? 'Guardar frase' : 'Crear frase';
  });

  readonly tickerItemForm = this.formBuilder.group({
    text: ['', [Validators.required, Validators.maxLength(120)]],
    sortOrder: [0, [Validators.required]],
    isActive: [true],
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.tickerItemForm.invalid) {
      this.tickerItemForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    try {
      const payload = this.buildPayload();
      const editingItemId = this.editingItemId();

      if (editingItemId) {
        await firstValueFrom(
          this.adminContentApiService.updateTickerItem(editingItemId, payload as UpdateTickerItemRequest),
        );
        this.successMessage.set('Frase actualizada.');
      } else {
        await firstValueFrom(
          this.adminContentApiService.createTickerItem(payload as CreateTickerItemRequest),
        );
        this.successMessage.set('Frase creada.');
      }

      this.resetForm();
      await this.load();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  startEdit(item: TickerItemResponse): void {
    this.editingItemId.set(item.id);
    this.submitted.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.tickerItemForm.patchValue(
      {
        text: item.text,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      },
      { emitEvent: false },
    );
  }

  resetForm(): void {
    this.editingItemId.set(null);
    this.submitted.set(false);
    this.tickerItemForm.reset(
      {
        text: '',
        sortOrder: 0,
        isActive: true,
      },
      { emitEvent: false },
    );
  }

  async deleteTickerItem(item: TickerItemResponse): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar frase del ticker?',
      message: `Se eliminará "${item.text}" de forma permanente.`,
    });
    if (!confirmed) return;

    this.deletingItemId.set(item.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(this.adminContentApiService.deleteTickerItem(item.id));
      this.successMessage.set('Frase eliminada.');

      if (this.editingItemId() === item.id) {
        this.resetForm();
      }

      await this.load();
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.deletingItemId.set(null);
    }
  }

  showError(controlName: 'text' | 'sortOrder', errorName: string): boolean {
    const control = this.tickerItemForm.controls[controlName];
    return control.hasError(errorName) && (control.touched || this.submitted());
  }

  private buildPayload(): CreateTickerItemRequest {
    const value = this.tickerItemForm.getRawValue();

    return {
      text: value.text?.trim() ?? '',
      sortOrder: Number(value.sortOrder ?? 0),
      isActive: !!value.isActive,
    };
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const items = await firstValueFrom(this.adminContentApiService.listTickerItems());
      this.tickerItems.set(
        items
          .slice()
          .sort(
            (first, second) =>
              first.sortOrder - second.sortOrder ||
              first.createdAtUtc.localeCompare(second.createdAtUtc),
          ),
      );
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
      this.tickerItems.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }
}
