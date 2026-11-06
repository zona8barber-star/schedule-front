/** Mirrors `LoyaltyWalletContracts` in the API (ADR-0013, ADR-0014, ADR-0015). */

import { LoyaltyRedemptionView } from './loyalty-redemption.models';

export type LoyaltyAdjustmentDirection = 'Credit' | 'Debit';

export interface LoyaltyLotView {
  id: string;
  sourceType: 'ServiceRecord' | 'Membership' | 'Adjustment';
  sourceId: string;
  sourceLabel: string;
  initialPoints: number;
  remainingPoints: number;
  /** 0 once `expiresOn` (inclusive, Bogotá) has passed, even before the daily job records it. */
  usablePoints: number;
  accruedOn: string;
  validityDays: number;
  expiresOn: string;
  isExpired: boolean;
  originLotId: string | null;
  originCustomerId: string | null;
  /** Held for pending redemptions: out of the free balance, and they do not expire while held. */
  reservedPoints: number;
}

export interface LoyaltyDebtView {
  id: string;
  origin: string;
  amount: number;
  outstandingPoints: number;
  originDebtId: string | null;
  originCustomerId: string | null;
  /** When this row was written (for a debt moved by a merge: the merge). */
  createdAt: string;
  /** When the original debt arose; kept through merges and used to settle the oldest first. */
  incurredAt: string;
}

export interface LoyaltyMovementView {
  id: string;
  type: string;
  points: number;
  lotId: string | null;
  debtId: string | null;
  reason: string | null;
  relatedCustomerId: string | null;
  performedByName: string | null;
  performedAt: string;
  redemptionId: string | null;
}

export interface LoyaltyWalletView {
  customerId: string;
  /** The surviving profile that holds the points when this one was merged. */
  liveCustomerId: string;
  isMerged: boolean;
  programEnabled: boolean;
  availablePoints: number;
  debtPoints: number;
  expiringSoonPoints: number;
  nextExpiresOn: string | null;
  lots: LoyaltyLotView[];
  debts: LoyaltyDebtView[];
  movements: LoyaltyMovementView[];
  reservedPoints: number;
  redemptions: LoyaltyRedemptionView[] | null;
}

export interface LoyaltyAdjustmentRequest {
  direction: LoyaltyAdjustmentDirection;
  points: number;
  reason: string;
  /** Stable for retries of the same adjustment; renew it only after a success. */
  idempotencyKey: string;
}

export interface MyLoyaltyLotView {
  usablePoints: number;
  accruedOn: string;
  expiresOn: string;
  sourceLabel: string;
}

export interface MyLoyaltyMovementView {
  type: string;
  points: number;
  performedAt: string;
}

export interface MyLoyaltyView {
  hasProfile: boolean;
  programEnabled: boolean;
  availablePoints: number;
  debtPoints: number;
  expiringSoonPoints: number;
  nextExpiresOn: string | null;
  lots: MyLoyaltyLotView[];
  movements: MyLoyaltyMovementView[];
  /** Held for pending redemptions; not part of the available points. */
  reservedPoints: number;
}

export interface MergeLoyaltyLotPreview {
  lotId: string;
  sourceLabel: string;
  points: number;
  expiresOn: string;
  expiresSoon: boolean;
}

export interface MergeLoyaltyPreview {
  sourceAvailablePoints: number;
  sourceDebtPoints: number;
  targetAvailablePoints: number;
  targetDebtPoints: number;
  resultAvailablePoints: number;
  resultDebtPoints: number;
  sourceExpiredPointsNotMoved: number;
  lotsToTransfer: MergeLoyaltyLotPreview[];
}

/** Spanish labels for the movement types (the API sends the enum names). */
export const LOYALTY_MOVEMENT_LABELS: Record<string, string> = {
  Accrual: 'Acumulación',
  MergeTransferIn: 'Recibido por fusión',
  AdjustmentCredit: 'Abono manual',
  Expiration: 'Vencimiento',
  MembershipAnnulmentWithdrawal: 'Retiro por anulación de membresía',
  AdjustmentDebit: 'Cargo manual',
  MergeTransferOut: 'Traspasado por fusión',
  DebtSettlement: 'Compensación de deuda',
  DebtMergeTransferOut: 'Deuda traspasada por fusión',
  DebtMergeTransferIn: 'Deuda recibida por fusión',
  DebtOpened: 'Deuda',
  RedemptionHold: 'Reservado para un canje',
  RedemptionRelease: 'Liberado de un canje',
  RedemptionConsumed: 'Canje entregado (usa los puntos ya reservados)',
};

/** Movement types that add points to the wallet (shown with a plus sign). */
export const LOYALTY_POSITIVE_MOVEMENTS = new Set(['Accrual', 'MergeTransferIn', 'AdjustmentCredit', 'RedemptionRelease']);

/**
 * Sign shown for a movement: '+' adds to the available points, '−' takes from them, '' changes neither (a delivery
 * consumes points that were already taken out when they were reserved).
 */
export function loyaltyMovementSign(type: string): string {
  if (type === 'RedemptionConsumed') {
    return '';
  }

  return LOYALTY_POSITIVE_MOVEMENTS.has(type) ? '+' : '−';
}

export function loyaltyMovementLabel(type: string): string {
  return LOYALTY_MOVEMENT_LABELS[type] ?? type;
}
