/** Same limits as the backend (`LoyaltySettings`). */
export const LOYALTY_MIN_VALIDITY_DAYS = 1;
export const LOYALTY_MAX_VALIDITY_DAYS = 3650;
export const LOYALTY_MAX_POINTS_PER_ITEM = 100000;
/** Calendar days to approve and to deliver a redemption (ADR-0015 R7). */
export const LOYALTY_MIN_REDEMPTION_DAYS = 1;
export const LOYALTY_MAX_REDEMPTION_DAYS = 365;

export interface LoyaltySettingsView {
  isEnabled: boolean;
  /** Global validity, in calendar days, of the points earned from now on. */
  pointsValidityDays: number;
  /** Concurrency token: send it back unchanged when updating. */
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
  /** Each redemption keeps the deadlines applied when it was requested. */
  redemptionApprovalDays: number;
  redemptionDeliveryDays: number;
}

export interface LoyaltySettingsUpdateRequest {
  isEnabled: boolean;
  pointsValidityDays: number;
  version: number;
  redemptionApprovalDays?: number;
  redemptionDeliveryDays?: number;
}

export interface LoyaltySettingsChangeView {
  id: string;
  changedAt: string;
  changedByUserId: string;
  changedByName: string | null;
  previousIsEnabled: boolean;
  newIsEnabled: boolean;
  previousPointsValidityDays: number;
  newPointsValidityDays: number;
  /** Null in changes recorded before the redemption deadlines existed. */
  previousRedemptionApprovalDays: number | null;
  newRedemptionApprovalDays: number | null;
  previousRedemptionDeliveryDays: number | null;
  newRedemptionDeliveryDays: number | null;
}
