export type MembershipPlanMode = 'Pool' | 'PerService';
export type MembershipGiftKind = 'Service' | 'Physical';
export type MembershipGiftCondition = 'EveryPurchase' | 'FirstPurchaseOfPlan';

export interface MembershipPlanServiceView {
  serviceId: string;
  serviceName: string;
  /** General service of the rate (ADR-0016 B4). */
  generalServiceName?: string | null;
  serviceBasePrice: number;
  serviceIsActive: boolean;
  /** Units for per-service plans; null for pool plans. */
  quantity: number | null;
}

export interface MembershipPlanGiftRuleView {
  id: string;
  kind: MembershipGiftKind;
  serviceId: string | null;
  serviceName: string | null;
  generalServiceName?: string | null;
  description: string | null;
  quantity: number;
  condition: MembershipGiftCondition;
}

export interface MembershipPlanView {
  id: string;
  name: string;
  description: string | null;
  price: number;
  mode: MembershipPlanMode;
  poolQuantity: number | null;
  defaultDurationDays: number;
  terms: string;
  specificConditions: string | null;
  isActive: boolean;
  services: MembershipPlanServiceView[];
  giftRules: MembershipPlanGiftRuleView[];
  createdAt: string;
  updatedAt: string | null;
  /** Fixed loyalty points buying it grants; 0 grants none. */
  loyaltyPoints: number;
}

export interface MembershipPlanServiceRequest {
  serviceId: string;
  quantity: number | null;
}

export interface MembershipPlanGiftRuleRequest {
  /** Existing rule being kept or edited; null for a new rule. */
  id: string | null;
  kind: MembershipGiftKind;
  serviceId: string | null;
  description: string | null;
  quantity: number;
  condition: MembershipGiftCondition;
}

export interface MembershipPlanUpsertRequest {
  name: string;
  description: string | null;
  price: number;
  mode: MembershipPlanMode;
  poolQuantity: number | null;
  defaultDurationDays: number;
  terms: string;
  specificConditions: string | null;
  services: MembershipPlanServiceRequest[];
  giftRules: MembershipPlanGiftRuleRequest[];
  /** Sent only by users with loyalty.settings.manage; when omitted the API keeps the current points. */
  loyaltyPoints?: number;
}

export interface MembershipPlanStatusUpdateRequest {
  isActive: boolean;
}

/**
 * "Servicio general · Tarifa" (ADR-0016 T10), so rates with the same name under different general services can be told
 * apart; just the rate when the general service is unknown. Plans keep referencing rates: only the label changes.
 */
export function planRateLabel(generalServiceName: string | null | undefined, rateName: string | null | undefined): string {
  const rate = rateName ?? '';
  return generalServiceName ? `${generalServiceName} · ${rate}` : rate;
}
