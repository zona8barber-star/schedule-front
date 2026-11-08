import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  CATALOG_MAX_SORT_ORDER,
  GeneralServiceView,
  ServiceCategoryView,
} from '../../../../../core/models/service-catalog.models';
import { AdminServiceCatalogApiService } from '../../../../../core/services/admin-service-catalog-api.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';

function integerValidator(control: AbstractControl): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

/** Master of the general services customers see, each in a service category (ADR-0016 B1). */
@Component({
  selector: 'app-admin-general-services-page',
  imports: [ReactiveFormsModule, RouterLink, ApiFeedbackComponent],
  templateUrl: './admin-general-services-page.component.html',
  styleUrl: '../../catalog-page.scss',
})
export class AdminGeneralServicesPageComponent implements OnInit {
  private readonly api = inject(AdminServiceCatalogApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly formBuilder = inject(FormBuilder);

  readonly maxSortOrder = CATALOG_MAX_SORT_ORDER;
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly categories = signal<ServiceCategoryView[]>([]);
  readonly services = signal<GeneralServiceView[]>([]);
  readonly busyId = signal<string | null>(null);
  /** '' shows every category. */
  readonly categoryFilter = signal('');

  readonly visibleServices = computed(() => {
    const filter = this.categoryFilter();
    return filter ? this.services().filter((service) => service.categoryId === filter) : this.services();
  });

  readonly isModalOpen = signal(false);
  readonly editing = signal<GeneralServiceView | null>(null);
  readonly isSaving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly modalTitle = computed(() => (this.editing() ? 'Editar servicio general' : 'Nuevo servicio general'));

  /** Active categories, plus the current one of the service being edited even if it is inactive. */
  readonly categoryOptions = computed(() => {
    const currentId = this.editing()?.categoryId ?? null;
    return this.categories().filter((category) => category.isActive || category.id === currentId);
  });

  readonly form = this.formBuilder.nonNullable.group({
    categoryId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(1000)]],
    sortOrder: [0, [Validators.required, Validators.min(0), Validators.max(CATALOG_MAX_SORT_ORDER), integerValidator]],
  });

  ngOnInit(): void {
    void this.load();
  }

  onFilterChange(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
  }

  openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    const categoryId = this.categoryFilter() || (this.categoryOptions()[0]?.id ?? '');
    this.form.reset({ categoryId, name: '', description: '', sortOrder: 0 });
    this.isModalOpen.set(true);
  }

  openEdit(service: GeneralServiceView): void {
    this.editing.set(service);
    this.formError.set(null);
    this.form.reset({
      categoryId: service.categoryId,
      name: service.name,
      description: service.description ?? '',
      sortOrder: service.sortOrder,
    });
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
    const description = this.form.controls.description.value.trim();
    const request = {
      categoryId: this.form.controls.categoryId.value,
      name: this.form.controls.name.value.trim(),
      description: description.length ? description : null,
      sortOrder: Math.trunc(this.form.controls.sortOrder.value),
    };

    try {
      const editing = this.editing();
      await firstValueFrom(
        editing ? this.api.updateGeneralService(editing.id, request) : this.api.createGeneralService(request),
      );
      this.isSaving.set(false);
      this.closeModal();
      // Order and the category counts change too: reload both lists.
      await this.load(false);
    } catch (error) {
      this.formError.set(getApiErrorMessage(error));
      this.isSaving.set(false);
    }
  }

  async toggleActive(service: GeneralServiceView): Promise<void> {
    this.busyId.set(service.id);
    this.errorMessage.set(null);
    try {
      const updated = await firstValueFrom(this.api.updateGeneralServiceStatus(service.id, { isActive: !service.isActive }));
      this.services.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  async remove(service: GeneralServiceView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar servicio general?',
      message: `Se eliminará "${service.name}". Solo es posible si no tiene tarifas.`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(service.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.api.removeGeneralService(service.id));
      this.services.update((list) => list.filter((item) => item.id !== service.id));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(showSpinner = true): Promise<void> {
    if (showSpinner) {
      this.isLoading.set(true);
    }
    this.errorMessage.set(null);
    try {
      const [categories, services] = await Promise.all([
        firstValueFrom(this.api.listCategories()),
        firstValueFrom(this.api.listGeneralServices()),
      ]);
      this.categories.set(categories);
      this.services.set(services);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }
}
