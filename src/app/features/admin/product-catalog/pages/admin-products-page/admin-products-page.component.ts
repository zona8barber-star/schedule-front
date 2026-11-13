import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { ProductCategoryView, ProductView, formatCop } from '../../../../../core/models/product-catalog.models';
import { CATALOG_MAX_SORT_ORDER } from '../../../../../core/models/service-catalog.models';
import { AdminProductCatalogApiService } from '../../../../../core/services/admin-product-catalog-api.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { MoneyConfirmationService } from '../../../../../core/services/money-confirmation.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readOptionParam,
  readPageParam,
  readPageSizeParam,
  readTextParam,
  toQueryParams,
} from '../../../../../core/utils/list-query.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { trimmedMinLength, trimmedRequired } from '../../../../../core/utils/form-validators';

const MAX_IMAGE_BYTES = 10_485_760; // 10 MB, same limit as the API

function integerValidator(control: AbstractControl): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

/**
 * Master of the products of the public catalog, each in a product category (ADR-0016 B5). The list is paginated on the
 * server with text, category and status filters kept in the URL (B7).
 */
import { FieldErrorComponent } from '../../../../../shared/components/field-error/field-error.component';

@Component({
  selector: 'app-admin-products-page',
  imports: [FieldErrorComponent, ReactiveFormsModule, RouterLink, ApiFeedbackComponent, PaginatorComponent],
  templateUrl: './admin-products-page.component.html',
  styleUrl: '../../../service-catalog/catalog-page.scss',
})
export class AdminProductsPageComponent implements OnInit {
  private readonly api = inject(AdminProductCatalogApiService);
  private readonly authService = inject(AuthService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly moneyConfirmation = inject(MoneyConfirmationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly maxSortOrder = CATALOG_MAX_SORT_ORDER;
  readonly formatPrice = formatCop;
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly categories = signal<ProductCategoryView[]>([]);
  readonly products = signal<ProductView[]>([]);
  readonly busyId = signal<string | null>(null);
  /** '' shows every category. */
  readonly categoryFilter = signal('');
  readonly query = signal('');
  readonly statusFilter = signal<'Active' | 'Inactive' | ''>('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);

  /** The current page (already filtered by the server). */
  readonly visibleProducts = computed(() => this.products());

  readonly isModalOpen = signal(false);
  readonly editing = signal<ProductView | null>(null);
  readonly isSaving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly modalTitle = computed(() => (this.editing() ? 'Editar producto' : 'Nuevo producto'));

  readonly imageUploading = signal(false);
  readonly imageError = signal<string | null>(null);
  readonly imagePreviewUrl = signal<string | null>(null);

  /** Active categories, plus the current one of the product being edited even if it is inactive. */
  readonly categoryOptions = computed(() => {
    const currentId = this.editing()?.categoryId ?? null;
    return this.categories().filter((category) => category.isActive || category.id === currentId);
  });

  readonly form = this.formBuilder.nonNullable.group({
    categoryId: ['', [Validators.required]],
    name: ['', [trimmedRequired, trimmedMinLength(2), Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(1000)]],
    price: [0, [Validators.required, Validators.min(0), integerValidator]],
    sortOrder: [0, [Validators.required, Validators.min(0), Validators.max(CATALOG_MAX_SORT_ORDER), integerValidator]],
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  onFilterChange(event: Event): void {
    this.navigate({ categoryId: (event.target as HTMLSelectElement).value, page: 1 });
  }

  onSearch(text: string): void {
    this.navigate({ q: text.trim(), page: 1 });
  }

  onStatusChange(event: Event): void {
    this.navigate({ status: (event.target as HTMLSelectElement).value, page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  openCreate(): void {
    this.editing.set(null);
    this.resetImageState();
    this.formError.set(null);
    const categoryId = this.categoryFilter() || (this.categoryOptions()[0]?.id ?? '');
    this.form.reset({ categoryId, name: '', description: '', price: 0, sortOrder: 0 });
    this.isModalOpen.set(true);
  }

  openEdit(product: ProductView): void {
    this.editing.set(product);
    this.resetImageState();
    this.formError.set(null);
    this.form.reset({
      categoryId: product.categoryId,
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      sortOrder: product.sortOrder,
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    if (this.isSaving() || this.imageUploading()) {
      return;
    }
    this.isModalOpen.set(false);
    this.editing.set(null);
    this.resetImageState();
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const confirmed = await this.moneyConfirmation.confirm({
      action: this.editing() ? 'Guardar el precio del producto' : 'Crear el producto',
      amount: Math.trunc(this.form.controls.price.value),
      detail: this.form.controls.name.value.trim() || undefined,
    });
    if (!confirmed) return;

    this.isSaving.set(true);
    this.formError.set(null);
    const description = this.form.controls.description.value.trim();
    const request = {
      categoryId: this.form.controls.categoryId.value,
      name: this.form.controls.name.value.trim(),
      description: description.length ? description : null,
      price: Math.trunc(this.form.controls.price.value),
      sortOrder: Math.trunc(this.form.controls.sortOrder.value),
    };

    try {
      const editing = this.editing();
      await firstValueFrom(editing ? this.api.updateProduct(editing.id, request) : this.api.createProduct(request));
      this.isSaving.set(false);
      this.closeModal();
      // Order and the category counts change too: reload both lists.
      await this.load(false);
    } catch (error) {
      this.formError.set(getApiErrorMessage(error));
      this.isSaving.set(false);
    }
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const product = this.editing();
    input.value = '';
    if (!file || !product) {
      return;
    }

    this.imageError.set(null);
    if (file.size === 0) {
      this.imageError.set('No pudimos leer el archivo seleccionado. Intenta de nuevo.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.imageError.set('La imagen no puede superar 10 MB.');
      return;
    }

    this.imageUploading.set(true);
    const preview = URL.createObjectURL(file);
    this.setPreview(preview);
    try {
      // The raw upload is not retried by the auth interceptor, so start it with a fresh token (as the staff photos).
      if (!(await this.authService.refreshAccessToken())) {
        this.imageError.set('Tu sesión expiró. Inicia sesión nuevamente e intenta subir la imagen otra vez.');
        return;
      }

      this.applyProduct(await firstValueFrom(this.api.uploadProductImage(product.id, file)));
    } catch (error) {
      this.imageError.set(getApiErrorMessage(error));
    } finally {
      this.setPreview(null);
      this.imageUploading.set(false);
    }
  }

  async removeImage(): Promise<void> {
    const product = this.editing();
    if (!product) {
      return;
    }
    const confirmed = await this.confirmModal.confirm({
      title: '¿Quitar imagen?',
      message: `Se quitará la imagen de "${product.name}".`,
    });
    if (!confirmed) {
      return;
    }

    this.imageError.set(null);
    this.imageUploading.set(true);
    try {
      this.applyProduct(await firstValueFrom(this.api.removeProductImage(product.id)));
    } catch (error) {
      this.imageError.set(getApiErrorMessage(error));
    } finally {
      this.imageUploading.set(false);
    }
  }

  async toggleActive(product: ProductView): Promise<void> {
    this.busyId.set(product.id);
    this.errorMessage.set(null);
    try {
      const updated = await firstValueFrom(this.api.updateProductStatus(product.id, { isActive: !product.isActive }));
      this.products.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  async remove(product: ProductView): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: '¿Eliminar producto?',
      message: `Se eliminará "${product.name}" del catálogo.`,
    });
    if (!confirmed) {
      return;
    }

    this.busyId.set(product.id);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.api.removeProduct(product.id));
      // Reload so the page and the count stay consistent with the server.
      await this.load(false);
    } catch (error) {
      this.errorMessage.set(getApiErrorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  private applyProduct(updated: ProductView): void {
    this.editing.set(updated);
    this.products.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
  }

  private setPreview(url: string | null): void {
    const previous = this.imagePreviewUrl();
    if (previous?.startsWith('blob:')) {
      URL.revokeObjectURL(previous);
    }
    this.imagePreviewUrl.set(url);
  }

  private resetImageState(): void {
    this.setPreview(null);
    this.imageError.set(null);
  }

  private applyQuery(params: ParamMap): void {
    this.query.set(readTextParam(params, 'q'));
    this.categoryFilter.set(readTextParam(params, 'categoryId'));
    this.statusFilter.set(readOptionParam(params, 'status', ['Active', 'Inactive'] as const));
    this.page.set(readPageParam(params));
    this.pageSize.set(readPageSizeParam(params));
  }

  private navigate(patch: Record<string, QueryValue>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(patch),
      queryParamsHandling: 'merge',
    });
  }

  private async load(showSpinner = true): Promise<void> {
    const sequence = ++this.loadSequence;
    if (showSpinner) {
      this.isLoading.set(true);
    }
    this.errorMessage.set(null);
    try {
      const [categories, products] = await Promise.all([
        firstValueFrom(this.api.listCategories()),
        firstValueFrom(
          this.api.listProducts({
            q: this.query() || null,
            categoryId: this.categoryFilter() || null,
            status: this.statusFilter() || null,
            page: this.page(),
            pageSize: this.pageSize(),
          }),
        ),
      ]);
      if (sequence !== this.loadSequence) {
        return;
      }
      this.categories.set(categories);
      this.products.set(products.items);
      this.totalCount.set(products.totalCount);
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
