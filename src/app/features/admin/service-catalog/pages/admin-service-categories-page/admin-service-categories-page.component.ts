import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { CATALOG_MAX_SORT_ORDER, ServiceCategoryView } from '../../../../../core/models/service-catalog.models';
import { AdminServiceCatalogApiService } from '../../../../../core/services/admin-service-catalog-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { trimmedMinLength, trimmedRequired } from '../../../../../core/utils/form-validators';

function integerValidator(control: AbstractControl): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

/** Master of service categories (ADR-0016 B1), independent from product categories. */
import { FieldErrorComponent } from '../../../../../shared/components/field-error/field-error.component';

@Component({
  selector: 'app-admin-service-categories-page',
  imports: [FieldErrorComponent, ReactiveFormsModule, ApiFeedbackComponent],
  templateUrl: './admin-service-categories-page.component.html',
  styleUrl: '../../catalog-page.scss',
})
export class AdminServiceCategoriesPageComponent implements OnInit {
  private readonly api = inject(AdminServiceCatalogApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly formBuilder = inject(FormBuilder);

  readonly maxSortOrder = CATALOG_MAX_SORT_ORDER;
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly categories = signal<ServiceCategoryView[]>([]);
  readonly busyId = signal<string | null>(null);

  readonly isModalOpen = signal(false);
  readonly editing = signal<ServiceCategoryView | null>(null);
  readonly isSaving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly modalTitle = computed(() => (this.editing() ? 'Editar categoría' : 'Nueva categoría'));

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(80)]],
    sortOrder: [0, [Validators.required, Validators.min(0), Validators.max(CATALOG_MAX_SORT_ORDER), integerValidator]],
  });

  ngOnInit(): void {
    void this.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    const nextOrder = Math.max(-1, ...this.categories().map((category) => category.sortOrder)) + 1;
    this.form.reset({ name: '', sortOrder: Math.min(nextOrder, CATALOG_MAX_SORT_ORDER) });
    this.isModalOpen.set(true);
  }

  openEdit(category: ServiceCategoryView): void {
    this.editing.set(category);
    this.formError.set(null);
    this.form.reset({ name: category.name, sortOrder: category.sortOrder });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    if (this.isSaving()) {
      return;
    }
    this.isModalOpen.set(false);
    this.editing.set(null);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.formError.set(null);
    const request = {
      name: this.form.controls.name.value.trim(),
      sortOrder: Math.trunc(this.form.controls.sortOrder.value),
    };

    try {
      const editing = this.editing();
      const saved = editing
        ? await firstValueFrom(this.api.updateCategory(editing.id, request))
        : await firstValueFrom(this.api.createCategory(request));
      this.categories.update((list) => sortCategories([...list.filter((item) => item.id !== saved.id), saved]));
      this.isSaving.set(false);
      this.closeModal();
    } catch (error) {
      this.formError.set(getApiErrorMessage(error));
      this.isSaving.set(false);
    }
  }

  async toggleActive(category: ServiceCategoryView): Promise<void> {
    this.busyId.set(category.id);
    this.errorMessage.set(null);
    try {
      const updated = await firstValueFrom(this.api.updateCategoryStatus(category.id, { isActive: !category.isActive }));
      this.categories.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  async remove(category: ServiceCategoryView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar categoría?',
      message: `Se eliminará "${category.name}". Solo es posible si no tiene servicios generales.`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(category.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.api.removeCategory(category.id));
      this.categories.update((list) => list.filter((item) => item.id !== category.id));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.categories.set(await firstValueFrom(this.api.listCategories()));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}

function sortCategories(categories: ServiceCategoryView[]): ServiceCategoryView[] {
  return [...categories].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'es'),
  );
}
