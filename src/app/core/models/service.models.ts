export interface ServiceView {
  id: string;
  name: string;
  basePrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ServiceCreateRequest {
  name: string;
  basePrice: number;
}

export interface ServiceUpdateRequest {
  name: string;
  basePrice: number;
}

export interface ServiceStatusUpdateRequest {
  isActive: boolean;
}
