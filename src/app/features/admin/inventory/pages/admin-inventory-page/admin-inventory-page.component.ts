import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PERMISSION_CODES } from '../../../../../core/models/auth.models';
import {
  InventoryItemView,
  InventorySalesView,
  InventorySummaryView,
  formatCost,
  formatMargin,
} from '../../../../../core/models/inventory.models';
import { newIdempotencyKey } from '../../../../../core/models/loyalty-redemption.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { AdminInventoryApiService } from '../../../../../core/services/admin-inventory-api.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { MoneyConfirmationService, formatCop } from '../../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import { bogotaToday } from '../../../../../core/utils/bogota-date.utils';
import { trimmedMinLength, trimmedRequired } from '../../../../../core/utils/form-validators';
import {
  QueryValue,
  readOptionParam,
  readPageParam,
  readPageSizeParam,
  readTextParam,
  toQueryParams,
} from '../../../../../core/utils/list-query.utils';
import { SingleFlight } from '../../../../../core/utils/single-flight';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { FormA11yDirective } from '../../../../../shared/directives/form-a11y.directive';
import { ModalDialogDirective } from '../../../../../shared/directives/modal-dialog.directive';

export const INVENTORY_MAX_QUANTITY = 100_000;
export const INVENTORY_MAX_UNIT_COST = 100_000_000;

function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  return value === null || value === '' || Number.isInteger(value) ? null : { integer: true };
}

type InventoryModal = 'receipt' | 'adjust' | 'min-stock';

/**
 * Product inventory (ADR-0020, stage 1): stock, average cost, unit profit and the low stock alert, with merchandise
 * receipts (and the optional purchase expense), manual adjustments with a reason and the minimum stock. Filters and the
 * page live in the URL, as in the other lists.
 */
@Component({
  selector: 'app-admin-inventory-page',
  imports: [FormA11yDirective, ModalDialogDirective, ReactiveFormsModule, RouterLink, ApiFeedbackComponent, PaginatorComponent],
  templateUrl: './admin-inventory-page.component.html',
  styleUrls: ['../../../service-catalog/catalog-page.scss', '../inventory.scss'],
})
export class AdminInventoryPageComponent implements OnInit {
  private readonly api = inject(AdminInventoryApiService);
  private readonly authService = inject(AuthService);
  private readonly moneyConfirmation = inject(MoneyConfirmationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;
  private movementKey = newIdempotencyKey();

  readonly formatCost = formatCost;
  readonly formatMargin = formatMargin;

  /** Rotation figures keep up to 2 decimals, in Colombian notation. */
  formatDecimal(value: number): string {
    return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  }

  /** «Sin ventas» when nothing was sold in the range (no pace to measure). */
  coverageLabel(days: number | null): string {
    if (days === null) {
      return 'Sin ventas';
    }
    return days === 1 ? '1 día' : `${this.formatDecimal(days)} días`;
  }
  readonly formatCop = formatCop;
  readonly maxQuantity = INVENTORY_MAX_QUANTITY;
  readonly maxUnitCost = INVENTORY_MAX_UNIT_COST;
  readonly canReceive = computed(() => this.authService.hasPermission(PERMISSION_CODES.inventoryReceive));
  readonly canAdjust = computed(() => this.authService.hasPermission(PERMISSION_CODES.inventoryAdjust));

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly items = signal<InventoryItemView[]>([]);
  readonly summary = signal<InventorySummaryView | null>(null);
  readonly query = signal('');
  readonly lowStockOnly = signal(false);
  readonly statusFilter = signal<'Active' | 'Inactive' | ''>('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);
  readonly hasFilters = computed(() => !!this.query() || this.lowStockOnly() || !!this.statusFilter());

  readonly modal = signal<InventoryModal | null>(null);
  readonly selected = signal<InventoryItemView | null>(null);
  readonly isSaving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly today = signal(bogotaToday());

  readonly receiptForm = this.formBuilder.group({
    quantity: [null as number | null, [Validators.required, Validators.min(1), Validators.max(INVENTORY_MAX_QUANTITY), integerValidator]],
    unitCost: [null as number | null, [Validators.required, Validators.min(0), Validators.max(INVENTORY_MAX_UNIT_COST), integerValidator]],
    occurredOn: ['', [Validators.required]],
    supplier: ['', [Validators.maxLength(120)]],
    reference: ['', [Validators.maxLength(120)]],
    createExpense: [false],
  });

  readonly adjustForm = this.formBuilder.nonNullable.group({
    direction: ['Out' as 'In' | 'Out', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(1), Validators.max(INVENTORY_MAX_QUANTITY), integerValidator]],
    reason: ['', [trimmedRequired, trimmedMinLength(3), Validators.maxLength(500)]],
  });

  readonly minStockForm = this.formBuilder.group({
    minStock: [null as number | null, [Validators.min(0), Validators.max(INVENTORY_MAX_QUANTITY), integerValidator]],
  });

  /** ADR-0020 stage 3: profit by product from the real sales of approved bills, loaded on demand. */
  readonly sales = signal<InventorySalesView | null>(null);
  readonly salesError = signal<string | null>(null);
  readonly isLoadingSales = signal(false);

  /** Total of the receipt being typed, for the form and the money confirmation. */
  readonly receiptTotal = signal(0);

  ngOnInit(): void {
    this.receiptForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const quantity = Number(value.quantity) || 0;
      const cost = Number(value.unitCost) || 0;
      this.receiptTotal.set(Math.max(quantity, 0) * Math.max(cost, 0));
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  onSearch(text: string): void {
    this.navigate({ q: text.trim(), page: 1 });
  }

  onStatusChange(event: Event): void {
    this.navigate({ status: (event.target as HTMLSelectElement).value, page: 1 });
  }

  onLowStockChange(event: Event): void {
    this.navigate({ lowStock: (event.target as HTMLInputElement).checked ? 'true' : null, page: 1 });
  }

  showLowStock(): void {
    this.navigate({ lowStock: 'true', page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  async loadSales(from: string | null = null, to: string | null = null): Promise<void> {
    this.isLoadingSales.set(true);
    this.salesError.set(null);
    try {
      this.sales.set(await firstValueFrom(this.api.sales(from || null, to || null)));
    } catch (error) {
      this.salesError.set(getApiErrorMessage(error));
    } finally {
      this.isLoadingSales.set(false);
    }
  }

  openReceipt(item: InventoryItemView): void {
    this.today.set(bogotaToday());
    this.receiptForm.reset({
      quantity: null,
      unitCost: item.averageUnitCost === null ? null : Math.round(item.averageUnitCost),
      occurredOn: this.today(),
      supplier: '',
      reference: '',
      createExpense: false,
    });
    this.open('receipt', item);
  }

  openAdjust(item: InventoryItemView): void {
    this.adjustForm.reset({ direction: 'Out', quantity: 1, reason: '' });
    this.open('adjust', item);
  }

  openMinStock(item: InventoryItemView): void {
    this.minStockForm.reset({ minStock: item.minStock });
    this.open('min-stock', item);
  }

  closeModal(): void {
    if (this.isSaving()) {
      return;
    }
    this.modal.set(null);
    this.selected.set(null);
  }

  @SingleFlight()
  async saveReceipt(): Promise<void> {
    const item = this.selected();
    if (!item) return;
    const value = this.receiptForm.getRawValue();
    if (this.receiptForm.invalid || !value.occurredOn || value.occurredOn > this.today()) {
      this.receiptForm.markAllAsTouched();
      return;
    }

    const quantity = Math.trunc(value.quantity!);
    const unitCost = Math.trunc(value.unitCost!);
    if (value.createExpense && quantity * unitCost <= 0) {
      this.formError.set('Para crear el gasto de compra, el costo por unidad debe ser mayor que 0.');
      return;
    }

    const confirmed = await this.moneyConfirmation.confirm({
      action: value.createExpense ? 'Registrar la entrada y el gasto de compra' : 'Registrar la entrada',
      amount: quantity * unitCost,
      detail: `${quantity} × ${formatCop(unitCost)} · ${item.name}`,
    });
    if (!confirmed) return;

    await this.submit(
      () =>
        this.api.receive(item.productId, {
          idempotencyKey: this.movementKey,
          quantity,
          unitCost,
          occurredOn: value.occurredOn,
          supplier: value.supplier?.trim() || null,
          reference: value.reference?.trim() || null,
          createExpense: !!value.createExpense,
        }),
      `Entrada registrada: ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} de «${item.name}».`,
    );
  }

  @SingleFlight()
  async saveAdjust(): Promise<void> {
    const item = this.selected();
    if (!item) return;
    if (this.adjustForm.invalid) {
      this.adjustForm.markAllAsTouched();
      return;
    }

    const value = this.adjustForm.getRawValue();
    const quantity = Math.trunc(value.quantity);
    if (value.direction === 'Out' && quantity > item.onHand) {
      this.formError.set(`Solo puedes restar hasta ${Math.max(item.onHand, 0)} unidades: la existencia no puede quedar por debajo de cero.`);
      return;
    }

    await this.submit(
      () =>
        this.api.adjust(item.productId, {
          idempotencyKey: this.movementKey,
          direction: value.direction,
          quantity,
          reason: value.reason.trim(),
        }),
      `Ajuste registrado en «${item.name}».`,
    );
  }

  @SingleFlight()
  async saveMinStock(): Promise<void> {
    const item = this.selected();
    if (!item) return;
    if (this.minStockForm.invalid) {
      this.minStockForm.markAllAsTouched();
      return;
    }

    const raw = this.minStockForm.controls.minStock.value;
    const minStock = raw === null || (raw as unknown) === '' ? null : Math.trunc(raw);
    this.isSaving.set(true);
    this.formError.set(null);
    try {
      await firstValueFrom(this.api.setMinStock(item.productId, minStock));
      this.isSaving.set(false);
      this.closeModal();
      this.successMessage.set(
        minStock === null ? `«${item.name}» ya no tiene stock mínimo.` : `Stock mínimo de «${item.name}»: ${minStock}.`,
      );
      await this.load(false);
    } catch (error) {
      this.formError.set(getApiErrorMessage(error));
      this.isSaving.set(false);
    }
  }

  private async submit(request: () => ReturnType<AdminInventoryApiService['receive']>, success: string): Promise<void> {
    this.isSaving.set(true);
    this.formError.set(null);
    try {
      await firstValueFrom(request());
      // A new key only after a stored movement: a retry after an error must reuse the same one.
      this.movementKey = newIdempotencyKey();
      this.isSaving.set(false);
      this.closeModal();
      this.successMessage.set(success);
      await this.load(false);
    } catch (error) {
      this.formError.set(getApiErrorMessage(error));
      this.isSaving.set(false);
    }
  }

  private open(kind: InventoryModal, item: InventoryItemView): void {
    this.movementKey = newIdempotencyKey();
    this.formError.set(null);
    this.successMessage.set(null);
    this.selected.set(item);
    this.modal.set(kind);
  }

  private applyQuery(params: ParamMap): void {
    this.query.set(readTextParam(params, 'q'));
    this.lowStockOnly.set(readOptionParam(params, 'lowStock', ['true'] as const) === 'true');
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
      const [summary, page] = await Promise.all([
        firstValueFrom(this.api.summary()),
        firstValueFrom(
          this.api.list({
            q: this.query() || null,
            lowStock: this.lowStockOnly() || null,
            status: this.statusFilter() || null,
            page: this.page(),
            pageSize: this.pageSize(),
          }),
        ),
      ]);
      if (sequence !== this.loadSequence) {
        return;
      }
      this.summary.set(summary);
      this.items.set(page.items);
      this.totalCount.set(page.totalCount);
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
