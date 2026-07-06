export interface IncomeEntryView {
  id: string;
  serviceId: string;
  serviceName: string;
  basePrice: number;
  staffProfileId: string;
  staffDisplayName: string;
  amount: number;
  isPromo: boolean;
  occurredOn: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string | null;
}

export interface IncomeEntryCreateRequest {
  serviceId: string;
  staffProfileId: string;
  amount: number;
  isPromo: boolean;
  occurredOn: string; // YYYY-MM-DD
}

export interface IncomeEntryUpdateRequest {
  serviceId: string;
  staffProfileId: string;
  amount: number;
  isPromo: boolean;
  occurredOn: string; // YYYY-MM-DD
}
