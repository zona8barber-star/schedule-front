import { PageQuery } from './paged-result.models';

export type ServiceRecordStatus = 'Pending' | 'Approved' | 'Rejected';
export type ServiceRecordOperationType = 'Paid' | 'MembershipConsumption' | 'Courtesy' | 'LoyaltyReward';

export const SERVICE_RECORD_STATUS_LABELS: Record<ServiceRecordStatus, string> = {
  Pending: 'Pendiente de validación',
  Approved: 'Confirmado',
  Rejected: 'Rechazado',
};

export const SERVICE_RECORD_OPERATION_LABELS: Record<ServiceRecordOperationType, string> = {
  Paid: 'Servicio pagado',
  MembershipConsumption: 'Consumo de membresía',
  Courtesy: 'Cortesía',
  LoyaltyReward: 'Recompensa de fidelización',
};

export interface ServiceRecordApprovalView {
  operationType: ServiceRecordOperationType;
  serviceId: string;
  serviceName: string;
  generalServiceId?: string | null;
  generalServiceName?: string | null;
  staffProfileId: string;
  staffName: string | null;
  customerId: string | null;
  customerName: string | null;
  performedOn: string;
  chargedAmount: number | null;
  incomeEntryId: string | null;
  customerMembershipId: string | null;
  membershipConsumptionId: string | null;
  accruesLoyaltyPoints: boolean;
  loyaltyPointsSnapshot: number | null;
  reviewNotes: string | null;
  approvedAt: string;
  approvedByName: string | null;
  /** ADR-0018 D1: an Admin approved a service where they are the customer or the registering professional. */
  isSelfApproved?: boolean;
  /** For a loyalty reward: the redemption it delivered and the commission the business covers (informative). */
  loyaltyRedemptionId?: string | null;
  rewardName?: string | null;
  rewardBasePriceSnapshot?: number | null;
  rewardBusinessPercentageSnapshot?: number | null;
  rewardProfessionalCommission?: number | null;
}

export interface ServiceRecordView {
  id: string;
  status: ServiceRecordStatus;
  appointmentId: string | null;
  appointmentStartsAt: string | null;
  staffProfileId: string;
  staffName: string | null;
  /** Settlement rate; null on records registered by general service until they are approved (ADR-0016 B4). */
  serviceId: string | null;
  /** Registered name. */
  serviceName: string;
  generalServiceId?: string | null;
  generalServiceName?: string | null;
  performedOn: string;
  customerId: string | null;
  customerName: string | null;
  notes: string | null;
  registeredAt: string;
  registeredByName: string | null;
  approval: ServiceRecordApprovalView | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  /** Concurrency token: send it back unchanged when reviewing. */
  version: number;
  /** Profile now linked to the account that booked the appointment; a suggestion, never applied automatically. */
  suggestedCustomerId?: string | null;
  suggestedCustomerName?: string | null;
  /** Approved records marked to accrue: 'Credited', or 'PredatesWallet' if approved before the wallet existed. */
  loyaltyAccrualStatus?: 'Credited' | 'PredatesWallet' | null;
}

export interface ServiceRecordApproveRequest {
  version: number;
  operationType: ServiceRecordOperationType;
  /** General service performed; the rate must belong to it (409 otherwise). */
  generalServiceId: string;
  serviceId: string;
  staffProfileId: string;
  customerId: string | null;
  performedOn: string;
  chargedAmount: number | null;
  customerMembershipId: string | null;
  accruesLoyaltyPoints: boolean;
  notes: string | null;
  /** Required for 'LoyaltyReward' (needs loyalty.redemptions.deliver too); omitted otherwise. */
  loyaltyRedemptionId?: string | null;
}

/** An approved service redemption that confirming a record as 'LoyaltyReward' delivers. */
export interface ServiceRecordRedemptionOption {
  id: string;
  rewardName: string;
  serviceId: string;
  serviceName: string;
  pointsCost: number;
  approvedAt: string;
  deliverBy: string;
  isPastDeadline: boolean;
}

export interface ServiceRecordRejectRequest {
  version: number;
  reason: string;
}

export interface ServiceRecordServiceOption {
  id: string;
  name: string;
  basePrice: number;
  loyaltyPoints: number;
  isActive: boolean;
  generalServiceId: string;
  generalServiceName: string;
}

export interface ServiceRecordGeneralServiceOption {
  id: string;
  name: string;
  categoryName: string;
  isActive: boolean;
}

export interface ServiceRecordStaffOption {
  id: string;
  displayName: string;
  isActive: boolean;
}

export interface ServiceRecordOptionsView {
  services: ServiceRecordServiceOption[];
  staff: ServiceRecordStaffOption[];
  loyaltyProgramEnabled: boolean;
  generalServices: ServiceRecordGeneralServiceOption[];
}

export interface ServiceRecordMembershipOption {
  id: string;
  planName: string;
  status: string;
  startsOn: string;
  endsOn: string;
}

/** Reduced for approvers: the phone only as a hint (last four digits). */
export interface ServiceRecordCustomerOption {
  id: string;
  fullName: string;
  phoneHint: string;
  memberships: ServiceRecordMembershipOption[];
}

/** A possible duplicate, reduced for approvers: hints only, and no id for a matching app account. */
export interface ServiceRecordCustomerDuplicate {
  kind: 'customer' | 'account';
  customerId: string | null;
  fullName: string;
  emailHint: string | null;
  phoneHint: string | null;
  matchedOn: ('email' | 'phone')[];
}

/** Possible duplicates found through real relations; warnings only, never a block. */
export interface ServiceRecordRelatedView {
  manualIncomes: { id: string; amount: number; occurredOn: string; createdAt: string }[];
  otherRecords: { id: string; status: ServiceRecordStatus; serviceName: string; performedOn: string; registeredAt: string }[];
  membershipConsumptions: {
    id: string;
    customerMembershipId: string;
    serviceName: string;
    serviceDate: string;
    isFromServiceRecord: boolean;
  }[];
  appointmentStatus: string | null;
}

/** Filters of GET /admin/service-records (ADR-0016 B7). Status defaults to Pending. */
export interface ServiceRecordListQuery extends PageQuery {
  status?: ServiceRecordStatus | null;
  from?: string | null;
  to?: string | null;
  staffProfileId?: string | null;
  generalServiceId?: string | null;
}
