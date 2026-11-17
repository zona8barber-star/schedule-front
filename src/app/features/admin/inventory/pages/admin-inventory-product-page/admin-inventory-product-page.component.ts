import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  INVENTORY_MOVEMENT_LABELS,
  InventoryItemView,
  InventoryMovementType,
  InventoryMovementView,
  formatCost,
  formatMargin,
} from '../../../../../core/models/inventory.models';
import { DEFAULT_PAGE_SIZE } from '../../../../../core/models/paged-result.models';
import { AdminInventoryApiService } from '../../../../../core/services/admin-inventory-api.service';
import { formatCop } from '../../../../../core/services/money-confirmation.service';
import { getApiErrorMessage } from '../../../../../core/utils/api-error.utils';
import {
  QueryValue,
  readOptionParam,
  readPageParam,
  readPageSizeParam,
  toQueryParams,
} from '../../../../../core/utils/list-query.utils';
import { isGuid, isNotFoundError } from '../../../../../core/utils/route-id.utils';
import { ApiFeedbackComponent } from '../../../../../shared/components/api-feedback/api-feedback.component';
import { NotFoundStateComponent } from '../../../../../shared/components/not-found-state/not-found-state.component';
import { PaginatorComponent } from '../../../../../shared/components/paginator/paginator.component';
import { BogotaDatePipe } from '../../../../../shared/pipes/bogota-date.pipe';

const MOVEMENT_TYPES = ['Receipt', 'AdjustmentIn', 'AdjustmentOut', 'Sale', 'SaleReversal'] as const;

/**
 * Stock card (kardex) of one product (ADR-0020, stage 1): every movement, newest first, with the stock and the average
 * cost it left. Movements are never edited or deleted. The type filter and the page live in the URL.
 */
@Component({
  selector: 'app-admin-inventory-product-page',
  imports: [RouterLink, DatePipe, BogotaDatePipe, ApiFeedbackComponent, NotFoundStateComponent, PaginatorComponent],
  templateUrl: './admin-inventory-product-page.component.html',
  styleUrls: ['../../../service-catalog/catalog-page.scss', '../inventory.scss'],
})
export class AdminInventoryProductPageComponent implements OnInit {
  private readonly api = inject(AdminInventoryApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  readonly labels = INVENTORY_MOVEMENT_LABELS;
  readonly movementTypes = MOVEMENT_TYPES;
  readonly formatCost = formatCost;
  readonly formatMargin = formatMargin;
  readonly formatCop = formatCop;

  readonly isLoading = signal(true);
  readonly notFound = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly item = signal<InventoryItemView | null>(null);
  readonly movements = signal<InventoryMovementView[]>([]);
  readonly typeFilter = signal<InventoryMovementType | ''>('');
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQuery(params);
      void this.load();
    });
  }

  onTypeChange(event: Event): void {
    this.navigate({ type: (event.target as HTMLSelectElement).value, page: 1 });
  }

  onPageChange(page: number): void {
    this.navigate({ page });
  }

  detail(movement: InventoryMovementView): string {
    const parts = [movement.reason, movement.supplier, movement.reference ? `Ref. ${movement.reference}` : null];
    if (movement.expenseEntryId) {
      parts.push('Gasto de compra creado');
    }
    return parts.filter((part): part is string => !!part).join(' · ') || '—';
  }

  private applyQuery(params: ParamMap): void {
    this.typeFilter.set(readOptionParam(params, 'type', MOVEMENT_TYPES));
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

  private async load(): Promise<void> {
    const sequence = ++this.loadSequence;
    const productId = this.route.snapshot.paramMap.get('productId');
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.notFound.set(false);
    if (!isGuid(productId)) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    try {
      const [item, page] = await Promise.all([
        firstValueFrom(this.api.get(productId)),
        firstValueFrom(
          this.api.movements(productId, {
            type: this.typeFilter() || null,
            page: this.page(),
            pageSize: this.pageSize(),
          }),
        ),
      ]);
      if (sequence !== this.loadSequence) {
        return;
      }
      this.item.set(item);
      this.movements.set(page.items);
      this.totalCount.set(page.totalCount);
    } catch (error) {
      if (sequence !== this.loadSequence) {
        return;
      }
      if (isNotFoundError(error)) {
        this.notFound.set(true);
      } else {
        this.errorMessage.set(getApiErrorMessage(error));
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.isLoading.set(false);
      }
    }
  }
}
