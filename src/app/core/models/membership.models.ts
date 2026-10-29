import { MembershipGiftCondition, MembershipGiftKind, MembershipPlanMode } from './membership-plan.models';

export type MembershipStatus = 'PendingActivation' | 'Active' | 'Annulled';

/** Stored status plus dates: an active membership can still be scheduled (not started) or expired. */
export type MembershipDisplayStatus = 'PendingActivation' | 'Scheduled' | 'Active' | 'Expired' | 'Annulled';

export type MembershipGiftStatus = 'Granted' | 'Blocked' | 'PendingDelivery' | 'Delivered' | 'NotDeliverable';

export type MembershipEventType =
  | 'Sold'
  | 'Activated'
  | 'ActivatedAfterExpiry'
  | 'IncomeLinked'
  | 'IncomeUnlinked'
  | 'MovedByMerge'
  | 'Annulled';

export interface CustomerMembershipSummaryView {
  id: string;
  customerId: string;
  planName: string;
  price: number;
  mode: MembershipPlanMode;
  status: MembershipStatus;
  displayStatus: MembershipDisplayStatus;
  soldOn: string;
  startsOn: string;
  endsOn: string;
  purchasedQuantity: number;
  giftedServiceQuantity: number;
  physicalGiftCount: number;
  incomeEntryId: string | null;
  createdAt: string;
}

export interface MembershipAllowanceView {
  id: string;
  origin: 'Purchased' | 'Gift';
  giftId: string | null;
  grantedQuantity: number;
  consumedQuantity: number;
  availableQuantity: number;
  services: { serviceId: string; serviceName: string }[];
}

export interface MembershipGiftView {
  id: string;
  kind: MembershipGiftKind;
  condition: MembershipGiftCondition;
  quantity: number;
  serviceId: string | null;
  serviceName: string | null;
  description: string | null;
  status: MembershipGiftStatus;
  /** The current (not reversed) delivery of a physical gift, if any. */
  deliveryId: string | null;
  deliveredOn: string | null;
}

export interface MembershipGiftDeliveryReversalView {
  reason: string;
  performedAt: string;
  performedByName: string;
}

export interface MembershipGiftDeliveryView {
  id: string;
  giftId: string;
  giftDescription: string;
  quantity: number;
  deliveredOn: string;
  registeredAt: string;
  registeredByName: string;
  reversal: MembershipGiftDeliveryReversalView | null;
}

export interface MembershipLinkedPeerView {
  membershipId: string;
  customerName: string;
  planName: string;
  price: number;
  status: MembershipStatus;
}

export interface MembershipIncomeView {
  incomeEntryId: string;
  amount: number;
  occurredOn: string;
  isDeleted: boolean;
  linkedMembershipsTotal: number;
  hasDiscrepancy: boolean;
  linkedMemberships: MembershipLinkedPeerView[];
}

export interface MembershipEventView {
  id: string;
  type: MembershipEventType;
  performedAt: string;
  performedByName: string;
  reason: string | null;
  incomeEntryId: string | null;
  relatedCustomerId: string | null;
  relatedCustomerName: string | null;
}

/** Units a consumption took from one balance line. */
export interface MembershipConsumptionPartView {
  allowanceId: string;
  origin: 'Purchased' | 'Gift';
  quantity: number;
}

export interface MembershipConsumptionReversalView {
  reason: string;
  performedAt: string;
  performedByName: string;
}

export interface MembershipConsumptionView {
  id: string;
  serviceId: string;
  serviceName: string;
  quantity: number;
  serviceDate: string;
  staffProfileId: string | null;
  staffName: string | null;
  registeredAt: string;
  registeredByName: string;
  parts: MembershipConsumptionPartView[];
  reversal: MembershipConsumptionReversalView | null;
}

export interface CustomerMembershipDetailView {
  id: string;
  customerId: string;
  customerName: string;
  originalCustomerId: string;
  originalCustomerName: string;
  membershipPlanId: string;
  planName: string;
  planDescription: string | null;
  price: number;
  mode: MembershipPlanMode;
  terms: string;
  specificConditions: string | null;
  soldOn: string;
  startsOn: string;
  endsOn: string;
  status: MembershipStatus;
  displayStatus: MembershipDisplayStatus;
  activatedAt: string | null;
  activatedByName: string | null;
  annulledAt: string | null;
  annulledByName: string | null;
  annulmentReason: string | null;
  allowances: MembershipAllowanceView[];
  gifts: MembershipGiftView[];
  income: MembershipIncomeView | null;
  events: MembershipEventView[];
  consumptions: MembershipConsumptionView[];
  giftDeliveries: MembershipGiftDeliveryView[];
  createdAt: string;
}

export interface MembershipIncomeCandidateView {
  incomeEntryId: string;
  amount: number;
  occurredOn: string;
  linkedMembershipsTotal: number;
  linkedMemberships: MembershipLinkedPeerView[];
}

export interface MembershipSaleRequest {
  planId: string;
  startsOn: string;
  endsOn: string | null;
  soldOn: string | null;
  activateNow: boolean;
  confirmExpiredActivation: boolean;
  activationReason: string | null;
}

export interface MembershipActivateRequest {
  confirmExpiredActivation: boolean;
  reason: string | null;
}

export interface MembershipAnnulRequest {
  reason: string;
}

export interface MembershipIncomeLinkRequest {
  incomeEntryId: string;
  additionalMembershipIds: string[];
  discrepancyJustification: string | null;
}

export interface MembershipIncomeUnlinkRequest {
  discrepancyJustification: string | null;
}

/** `idempotencyKey` is generated once per intended consumption, so a retried request is not counted twice. */
export interface MembershipConsumptionRequest {
  serviceId: string;
  quantity: number;
  serviceDate: string;
  staffProfileId: string | null;
  idempotencyKey: string;
}

export interface MembershipConsumptionReverseRequest {
  reason: string;
}

/** A whole physical gift is handed over; `idempotencyKey` makes a retried request count once. */
export interface MembershipGiftDeliveryRequest {
  deliveredOn: string;
  idempotencyKey: string;
}

export interface MembershipGiftDeliveryReverseRequest {
  reason: string;
}
