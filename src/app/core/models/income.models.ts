import { PageQuery, PagedResult } from './paged-result.models';

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
  /** Set when a confirmed service record created this income; it is then not editable from Ingresos. */
  serviceRecordId?: string | null;
}

export interface IncomeEntryCreateRequest {
  kind: IncomeKind;
  serviceId: string | null;
  staffProfileId: string | null;
  amount: number;
  isPromo: boolean;
  occurredOn: string; // YYYY-MM-DD
}

/** Editing a membership sale linked to memberships may need a justification (SONDA BUG-104). */
export interface IncomeEntryUpdateRequest extends IncomeEntryCreateRequest {
  discrepancyJustification?: string | null;
}

/** Filters of GET /admin/income (ADR-0016 B7). Without a range the API shows today. */
export interface IncomeListQuery extends PageQuery {
  from?: string | null; // YYYY-MM-DD, inclusive
  to?: string | null; // YYYY-MM-DD, inclusive
  staffProfileId?: string | null;
  kind?: IncomeKind | null;
  generalServiceId?: string | null;
}

/** A page of income plus the applied range and the total of every matching entry (not only this page). */
export interface IncomeEntriesPage extends PagedResult<IncomeEntryView> {
  from: string;
  to: string;
  totalAmount: number;
}
