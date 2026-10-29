export interface CustomerLinkedAccountView {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  linkedAt: string;
  linkedByName: string | null;
}

export interface CustomerListItem {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  linkedAccount: CustomerLinkedAccountView | null;
  createdAt: string;
}

export type CustomerEventType =
  | 'Created'
  | 'AccountLinked'
  | 'AccountUnlinked'
  | 'MergedFrom'
  | 'MergedInto';

export interface CustomerEventView {
  id: string;
  type: CustomerEventType;
  performedAt: string;
  performedByName: string;
  userId: string | null;
  userEmail: string | null;
  relatedCustomerId: string | null;
  relatedCustomerName: string | null;
  reason: string | null;
}

export interface CustomerDetailView {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  linkedAccount: CustomerLinkedAccountView | null;
  mergedIntoCustomerId: string | null;
  mergedIntoCustomerName: string | null;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  events: CustomerEventView[];
}

export interface CustomerCreateRequest {
  fullName: string;
  phone: string;
  email: string;
}

export type CustomerUpdateRequest = CustomerCreateRequest;

export interface CustomerDuplicateCandidate {
  kind: 'customer' | 'account';
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  matchedOn: ('email' | 'phone')[];
  /** Profile: it already has an account. Account: it already backs a profile. */
  isLinked: boolean;
}

export interface CustomerCreateFromAccountRequest {
  userId: string;
  /** Only needed when the account has no phone. */
  phone: string | null;
  identityVerified: boolean;
}

export interface CustomerAccountCandidate {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  createdAt: string;
}

export interface CustomerLinkAccountRequest {
  userId: string;
  identityVerified: boolean;
}

export interface CustomerUnlinkAccountRequest {
  reason: string;
}

export interface CustomerMergeRequest {
  sourceCustomerId: string;
}

export interface CustomerMergePreview {
  target: CustomerListItem;
  source: CustomerListItem;
  canMerge: boolean;
  blockingReasons: string[];
  warnings: string[];
  accountToTransfer: CustomerLinkedAccountView | null;
}
