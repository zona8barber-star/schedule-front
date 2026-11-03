/** Same limits as the backend (`LoyaltySettings`). */
export const LOYALTY_MIN_VALIDITY_DAYS = 1;
export const LOYALTY_MAX_VALIDITY_DAYS = 3650;
export const LOYALTY_MAX_POINTS_PER_ITEM = 100000;

export interface LoyaltySettingsView {
  isEnabled: boolean;
  /** Global validity, in calendar days, of the points earned from now on. */
  pointsValidityDays: number;
  /** Concurrency token: send it back unchanged when updating. */
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface LoyaltySettingsUpdateRequest {
  isEnabled: boolean;
  pointsValidityDays: number;
  version: number;
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
}
