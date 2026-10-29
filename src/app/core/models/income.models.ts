/**
 * Service income is a service a professional performed and is split with them; a membership sale has no
 * service or professional and belongs entirely to the business. The kind never changes after creation.
 */
export type IncomeKind = 'Service' | 'MembershipSale';

export interface IncomeEntryView {
  id: string;
  kind: IncomeKind;
  /** Null for membership sales. */
  serviceId: string | null;
  serviceName: string | null;
  basePrice: number;
  /** Null for membership sales. */
  staffProfileId: string | null;
  staffDisplayName: string | null;
  amount: number;
  isPromo: boolean;
  businessPercentage: number;
  businessAmount: number;
  professionalAmount: number;
  occurredOn: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string | null;
}

export interface IncomeEntryCreateRequest {
  kind: IncomeKind;
  serviceId: string | null;
  staffProfileId: string | null;
  amount: number;
  isPromo: boolean;
  occurredOn: string; // YYYY-MM-DD
}

export type IncomeEntryUpdateRequest = IncomeEntryCreateRequest;
