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
}

// loyaltyPoints is sent only by users with loyalty.settings.manage; when omitted the API keeps the current points.

export interface ServiceCreateRequest {
  name: string;
  basePrice: number;
  businessPercentage: number;
  loyaltyPoints?: number;
}

export interface ServiceUpdateRequest {
  name: string;
  basePrice: number;
  businessPercentage: number;
  loyaltyPoints?: number;
}

export interface ServiceStatusUpdateRequest {
  isActive: boolean;
}
