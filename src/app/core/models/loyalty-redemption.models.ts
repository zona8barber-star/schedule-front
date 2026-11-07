import { PageQuery } from './paged-result.models';

/** Mirrors `LoyaltyRedemptionContracts` in the API (ADR-0015). */

export type LoyaltyRewardKind = 'Service' | 'Other';

export type LoyaltyRedemptionStatus = 'Requested' | 'Approved' | 'Delivered' | 'Rejected' | 'Cancelled' | 'Expired';

export interface LoyaltyRewardView {
  id: string;
  name: string;
  description: string | null;
  kind: LoyaltyRewardKind;
  serviceId: string | null;
  serviceName: string | null;
  pointsCost: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string | null;
  updatedByName: string | null;
}

/** `serviceId` is required for 'Service' and must be null for 'Other'; editing sends the version read. */
export interface LoyaltyRewardUpsertRequest {
  name: string;
  description: string | null;
  kind: LoyaltyRewardKind;
  serviceId: string | null;
  pointsCost: number;
  isActive: boolean;
  version?: number | null;
}

export interface LoyaltyRewardChangeView {
  id: string;
  changeType: 'Created' | 'Updated';
  changedAt: string;
  changedByName: string | null;
  previousName: string | null;
  newName: string;
  previousDescription: string | null;
  newDescription: string | null;
  previousKind: LoyaltyRewardKind | null;
  newKind: LoyaltyRewardKind;
  previousServiceName: string | null;
  newServiceName: string | null;
  previousPointsCost: number | null;
  newPointsCost: number;
  previousIsActive: boolean | null;
  newIsActive: boolean;
}

export interface LoyaltyRewardServiceOption {
  id: string;
  name: string;
  isActive: boolean;
  /** General service the rate belongs to (ADR-0016 B4); null only for unexpected legacy data. */
  generalServiceId?: string | null;
  generalServiceName?: string | null;
}

export interface LoyaltyRedemptionAllocationView {
  lotId: string;
  points: number;
  expiresOn: string;
}

/** The reward as it was when requested; editing the catalog never changes it. */
export interface LoyaltyRedemptionView {
  id: string;
  customerId: string;
  customerName: string | null;
  rewardId: string;
  rewardName: string;
  rewardKind: LoyaltyRewardKind;
  serviceId: string | null;
  serviceName: string | null;
  pointsCost: number;
  status: LoyaltyRedemptionStatus;
  channel: 'App' | 'Counter';
  inPersonVerified: boolean;
  requestedAt: string;
  requestedByName: string | null;
  requestedOn: string;
  approvalDays: number;
  deliveryDays: number;
  approveBy: string;
  approvedAt: string | null;
  approvedByName: string | null;
  deliverBy: string | null;
  deliveredAt: string | null;
  deliveredByName: string | null;
  serviceRecordId: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
  cancelledByCustomer: boolean;
  expiredAt: string | null;
  /** Still pending but past its deadline: it can no longer be approved or delivered. */
  isPastDeadline: boolean;
  allocations: LoyaltyRedemptionAllocationView[];
  version: number;
}

export interface LoyaltyCounterRedemptionRequest {
  rewardId: string;
  inPersonVerified: boolean;
  approveNow: boolean;
  idempotencyKey: string;
}

export interface MyLoyaltyRewardView {
  id: string;
  name: string;
  description: string | null;
  kind: LoyaltyRewardKind;
  serviceName: string | null;
  pointsCost: number;
  canAfford: boolean;
}

export interface MyLoyaltyCatalogView {
  hasProfile: boolean;
  programEnabled: boolean;
  availablePoints: number;
  rewards: MyLoyaltyRewardView[];
}

export interface MyLoyaltyRedemptionView {
  id: string;
  rewardName: string;
  rewardKind: LoyaltyRewardKind;
  serviceName: string | null;
  pointsCost: number;
  status: LoyaltyRedemptionStatus;
  requestedAt: string;
  approveBy: string;
  approvedAt: string | null;
  deliverBy: string | null;
  deliveredAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledByCustomer: boolean;
  expiredAt: string | null;
  isPastDeadline: boolean;
  canCancel: boolean;
}

export const LOYALTY_REDEMPTION_STATUS_LABELS: Record<LoyaltyRedemptionStatus, string> = {
  Requested: 'Pendiente de aprobación',
  Approved: 'Aprobado, pendiente de entrega',
  Delivered: 'Entregado',
  Rejected: 'Rechazado',
  Cancelled: 'Cancelado',
  Expired: 'Vencido',
};

export const LOYALTY_REWARD_KIND_LABELS: Record<LoyaltyRewardKind, string> = {
  Service: 'Servicio',
  Other: 'Otra recompensa',
};

export function redemptionStatusLabel(status: string): string {
  return LOYALTY_REDEMPTION_STATUS_LABELS[status as LoyaltyRedemptionStatus] ?? status;
}

/** One key per intended operation, kept for retries and renewed only after a success. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Filters of GET /admin/loyalty/redemptions (ADR-0016 B7); dates are inclusive Bogotá days of the request. */
export interface LoyaltyRedemptionListQuery extends PageQuery {
  status?: LoyaltyRedemptionStatus | null;
  customerId?: string | null;
  from?: string | null;
  to?: string | null;
}
