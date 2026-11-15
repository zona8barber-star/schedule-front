import { PageQuery } from './paged-result.models';

/** Product inventory (ADR-0020, stage 1). Mirrors Barbershop.Application.Products.InventoryContracts. */

export type InventoryMovementType = 'Receipt' | 'AdjustmentIn' | 'AdjustmentOut' | 'Sale' | 'SaleReversal';

export interface InventoryItemView {
  productId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  price: number;
  onHand: number;
  /** Weighted average in pesos; null while no receipt has given the product a cost. */
  averageUnitCost: number | null;
  minStock: number | null;
  isLowStock: boolean;
  unitProfit: number | null;
  marginPercent: number | null;
  stockValue: number | null;
  updatedAt: string | null;
  /** ADR-0020: units of closed bills waiting for approval (they left the shop, not the stock yet). */
  committed?: number;
  /** On hand minus committed; the low stock alert compares it with the minimum. */
  available?: number;
}

/** Real sales of one product in the range (ADR-0020 stage 3), from the incomes of approved bills. */
export interface InventorySalesItemView {
  productId: string;
  name: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number | null;
  /** Units sold while the product had no registered cost: their profit is unknown. */
  unitsWithoutCost: number;
}

export interface InventorySalesView {
  from: string;
  to: string;
  items: InventorySalesItemView[];
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  unitsWithoutCost: number;
}

export interface InventorySummaryView {
  lowStockCount: number;
  negativeStockCount: number;
  stockValue: number;
  productsWithoutCost: number;
}

export interface InventoryMovementView {
  id: string;
  productId: string;
  type: InventoryMovementType;
  /** Signed: positive in, negative out. */
  quantity: number;
  unitCost: number | null;
  onHandAfter: number;
  averageUnitCostAfter: number | null;
  occurredOn: string;
  reason: string | null;
  supplier: string | null;
  reference: string | null;
  expenseEntryId: string | null;
  performedByName: string;
  createdAt: string;
}

export interface InventoryMovementResultView {
  item: InventoryItemView;
  movement: InventoryMovementView;
}

export interface InventoryListQuery extends PageQuery {
  q?: string | null;
  lowStock?: boolean | null;
  status?: 'Active' | 'Inactive' | null;
}

export interface InventoryMovementListQuery extends PageQuery {
  type?: InventoryMovementType | null;
}

/** `idempotencyKey` is generated once per intended movement, so a retried request is not counted twice. */
export interface InventoryReceiptRequest {
  idempotencyKey: string;
  quantity: number;
  unitCost: number;
  occurredOn?: string | null;
  supplier?: string | null;
  reference?: string | null;
  createExpense: boolean;
}

export interface InventoryAdjustmentRequest {
  idempotencyKey: string;
  direction: 'In' | 'Out';
  quantity: number;
  reason: string;
}

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  Receipt: 'Entrada de mercancía',
  AdjustmentIn: 'Ajuste: suma',
  AdjustmentOut: 'Ajuste: resta',
  Sale: 'Venta',
  SaleReversal: 'Venta revertida',
};

/** Pesos without decimals for display; the average cost keeps its decimals only in the API. */
export function formatCost(value: number | null): string {
  if (value === null) {
    return 'Sin costo';
  }
  const rounded = Math.round(value);
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '-' : ''}$ ${digits}`;
}

export function formatMargin(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
}
