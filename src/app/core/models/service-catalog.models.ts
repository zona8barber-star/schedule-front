// ADR-0016 B1: service categories and the general services customers see. The settlement rates (ServiceView) belong
// to one general service each.

export interface ServiceCategoryView {
  id: string;
  name: string;
  sortOrder: number;
  /** Immutable public code, generated once (reserved for stable links). */
  publicCode: string;
  isActive: boolean;
  generalServiceCount: number;
  activeGeneralServiceCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface ServiceCategoryUpsertRequest {
  name: string;
  sortOrder: number;
}

export interface GeneralServiceView {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIsActive: boolean;
  name: string;
  description: string | null;
  sortOrder: number;
  publicCode: string;
  isActive: boolean;
  rateCount: number;
  activeRateCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface GeneralServiceUpsertRequest {
  categoryId: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface CatalogStatusUpdateRequest {
  isActive: boolean;
}

export const CATALOG_MAX_SORT_ORDER = 9999;
