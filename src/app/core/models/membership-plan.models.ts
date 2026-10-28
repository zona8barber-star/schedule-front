export type MembershipPlanMode = 'Pool' | 'PerService';
export type MembershipGiftKind = 'Service' | 'Physical';
export type MembershipGiftCondition = 'EveryPurchase' | 'FirstPurchaseOfPlan';

export interface MembershipPlanServiceView {
  serviceId: string;
  serviceName: string;
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
}

export interface MembershipPlanStatusUpdateRequest {
  isActive: boolean;
}
