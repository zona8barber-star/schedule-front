import { PageQuery } from './paged-result.models';

/** A settlement rate (ADR-0016 D3): price, business share and points, attached to one general service. */
export interface ServiceView {
  id: string;
  name: string;
  basePrice: number;
  businessPercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  /** Fixed loyalty points it grants; 0 grants none. */
  loyaltyPoints: number;
  generalServiceId: string;
  generalServiceName: string;
  generalServiceIsActive: boolean;
  categoryId: string;
  categoryName: string;
}

// loyaltyPoints is sent only by users with loyalty.settings.manage; when omitted the API keeps the current points.
// generalServiceId is required to create a rate; on update it moves the rate to that general service.

export interface ServiceCreateRequest {
  name: string;
  basePrice: number;
  businessPercentage: number;
  loyaltyPoints?: number;
  generalServiceId: string;
}

export interface ServiceUpdateRequest {
  name: string;
  basePrice: number;
  businessPercentage: number;
  loyaltyPoints?: number;
  generalServiceId?: string;
}

export interface ServiceStatusUpdateRequest {
  isActive: boolean;
}

export type CatalogStatusFilter = 'Active' | 'Inactive';

/** Filters of GET /admin/services (ADR-0016 B7). */
export interface ServiceListQuery extends PageQuery {
  q?: string | null;
  generalServiceId?: string | null;
  categoryId?: string | null;
  status?: CatalogStatusFilter | null;
}
