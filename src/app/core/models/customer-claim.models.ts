export type CustomerClaimStatus = 'Pending' | 'Approved' | 'Rejected';

export const CUSTOMER_CLAIM_STATUS_LABELS: Record<CustomerClaimStatus, string> = {
  Pending: 'Pendiente de revisión',
  Approved: 'Aprobada',
  Rejected: 'Rechazada',
};

/** The signed-in customer's own profile: only their own data. */
export interface OwnCustomerProfileView {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  linkedAt: string;
}

/** One of the customer's own claims. It never tells which profile was chosen nor anything from it. */
export interface OwnCustomerClaimView {
  id: string;
  status: CustomerClaimStatus;
  fullName: string;
  phone: string;
  email: string;
  notes: string | null;
  submittedAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
}

export interface OwnCustomerStatusView {
  profile: OwnCustomerProfileView | null;
  pendingClaim: OwnCustomerClaimView | null;
  claims: OwnCustomerClaimView[];
  accountFullName: string;
  accountEmail: string;
  accountPhone: string | null;
}

export interface OwnCustomerProfileCreateRequest {
  fullName: string;
  phone: string;
  email: string;
}

export interface CustomerClaimCreateRequest {
  fullName: string;
  phone: string;
  email: string;
  notes: string | null;
  idempotencyKey: string;
}

export interface CustomerClaimView {
  id: string;
  status: CustomerClaimStatus;
  userId: string;
  accountFullName: string;
  accountEmail: string;
  accountIsActive: boolean;
  fullName: string;
  phone: string;
  email: string;
  notes: string | null;
  submittedAt: string;
  approvedCustomerId: string | null;
  approvedCustomerName: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNotes: string | null;
  /** Concurrency token: send it back unchanged when deciding. */
  version: number;
}

/** A profile the claim may belong to, reduced to hints. Matches are suggestions, never an automatic link. */
export interface CustomerClaimCandidate {
  customerId: string;
  fullName: string;
  phoneHint: string;
  emailHint: string | null;
  createdAt: string;
  membershipCount: number;
  isLinked: boolean;
  matchedOn: ('email' | 'phone')[];
}

export interface CustomerClaimApproveRequest {
  version: number;
  customerId: string;
  identityVerified: boolean;
  notes: string | null;
}

export interface CustomerClaimRejectRequest {
  version: number;
  reason: string;
}
