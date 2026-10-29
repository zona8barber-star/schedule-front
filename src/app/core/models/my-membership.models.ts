import { MembershipDisplayStatus, MembershipGiftStatus } from './membership.models';

/** Read-only views of the signed-in customer's own memberships (no admin audit data). */
export interface MyMembershipSummaryView {
  id: string;
  planName: string;
  displayStatus: MembershipDisplayStatus;
  startsOn: string;
  endsOn: string;
  purchasedGranted: number;
  purchasedAvailable: number;
  giftedGranted: number;
  giftedAvailable: number;
  pendingPhysicalGifts: number;
}

export interface MyMembershipBalanceView {
  origin: 'Purchased' | 'Gift';
  services: string[];
  grantedQuantity: number;
  consumedQuantity: number;
  availableQuantity: number;
}

export interface MyMembershipGiftView {
  kind: 'Service' | 'Physical';
  description: string;
  quantity: number;
  status: MembershipGiftStatus;
  deliveredOn: string | null;
}

export interface MyMembershipConsumptionView {
  serviceName: string;
  quantity: number;
  serviceDate: string;
  parts: { origin: 'Purchased' | 'Gift'; quantity: number }[];
  isReversed: boolean;
  reversedAt: string | null;
}

export interface MyMembershipView {
  id: string;
  planName: string;
  planDescription: string | null;
  price: number;
  mode: 'Pool' | 'PerService';
  displayStatus: MembershipDisplayStatus;
  soldOn: string;
  startsOn: string;
  endsOn: string;
  purchasedByName: string | null;
  balances: MyMembershipBalanceView[];
  gifts: MyMembershipGiftView[];
  consumptions: MyMembershipConsumptionView[];
  terms: string;
  specificConditions: string | null;
}
