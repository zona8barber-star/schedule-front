import { PageQuery } from './paged-result.models';

// ADR-0016 B5: masters of product categories and products (administration). B6: the anonymous product catalog.
// Products are catalog entries only: no inventory, cart or sales.

export interface ProductCategoryView {
  id: string;
  name: string;
  sortOrder: number;
  /** Immutable public code, generated once: the public catalog links use it. */
  publicCode: string;
  isActive: boolean;
  productCount: number;
  activeProductCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductCategoryUpsertRequest {
  name: string;
  sortOrder: number;
}

export interface ProductView {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIsActive: boolean;
  name: string;
  description: string | null;
  /** Whole Colombian pesos. */
  price: number;
  imageMediaAssetId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  publicCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductUpsertRequest {
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  sortOrder: number;
}

// ── Public catalog (B6) ─────────────────────────────────────────────────────

export interface PublicProductCategory {
  code: string;
  name: string;
  productCount: number;
}

export interface PublicProductSummary {
  code: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

export interface PublicProductCategoryDetail {
  code: string;
  name: string;
  products: PublicProductSummary[];
}

export interface PublicProduct {
  code: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryCode: string;
  categoryName: string;
}

/** Stable path of the public product catalog (the user prints a QR with it). */
export const PUBLIC_PRODUCT_CATALOG_PATH = '/productos';

const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** "$ 35.000" in Colombian pesos, without decimals. */
export function formatCop(value: number): string {
  return COP_FORMATTER.format(value);
}

/** Filters of GET /admin/products (ADR-0016 B7). */
export interface ProductListQuery extends PageQuery {
  q?: string | null;
  categoryId?: string | null;
  status?: 'Active' | 'Inactive' | null;
}
