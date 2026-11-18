export const ROLE_NAMES = {
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

// Mirrors the backend catalog (Barbershop.Domain.Users.PermissionCodes).
export const PERMISSION_CODES = {
  serviceRecordsRegister: 'service-records.register',
  serviceRecordsApprove: 'service-records.approve',
  loyaltySettingsManage: 'loyalty.settings.manage',
  loyaltyRewardsManage: 'loyalty.rewards.manage',
  loyaltyRedemptionsApprove: 'loyalty.redemptions.approve',
  loyaltyRedemptionsDeliver: 'loyalty.redemptions.deliver',
  loyaltyPointsAdjust: 'loyalty.points.adjust',
  membershipPaymentsConfirm: 'memberships.payments.confirm',
  customerClaimsApprove: 'customers.claims.approve',
  inventoryView: 'inventory.view',
  inventoryReceive: 'inventory.receive',
  inventoryAdjust: 'inventory.adjust',
  // ADR-0020: bills. Staff opens, closes and charges by default; discounts need bills.discount (Q2).
  billsOpen: 'bills.open',
  billsClose: 'bills.close',
  billsCharge: 'bills.charge',
  billsDiscount: 'bills.discount',
  billsManage: 'bills.manage',
  billsApprove: 'bills.approve',
  billsUnapprove: 'bills.unapprove',
  billsVoid: 'bills.void',
  // ADR-0021 L1: services and tips on another professional's name (Admin by default, not Staff).
  billsAssignOtherStaff: 'bills.assign-other-staff',
  // ADR-0021 L2: the cash closing, a permission of its own (Admin by default).
  reportsCashView: 'reports.cash.view',
} as const;

/**
 * Any permission that works with bills opens «Cuentas»; the API checks each action again. It mirrors the API policy
 * BillsAccess (SONDA BUG-130: bills.unapprove was missing, so whoever held only it could not reach «Desaprobar»).
 * bills.charge, bills.discount and bills.assign-other-staff only widen what a bill user can do, and reports.cash.view
 * has its own page (ADR-0021 L2), as in the API.
 */
export const BILLS_ACCESS_PERMISSIONS = [
  PERMISSION_CODES.billsOpen,
  PERMISSION_CODES.billsClose,
  PERMISSION_CODES.billsManage,
  PERMISSION_CODES.billsApprove,
  PERMISSION_CODES.billsUnapprove,
  PERMISSION_CODES.billsVoid,
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string | null;
}

export interface AuthUserResponse {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  roles: RoleName[];
  profilePhotoId: string | null;
  profilePhotoUrl: string | null;
  /** Only for showing or hiding UI; the API authorizes every request on its own. */
  permissions: string[];
}

export type CurrentUserResponse = AuthUserResponse;

export interface TokenResponse {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken?: string | null;
  user: AuthUserResponse;
}

export type AuthResponse = TokenResponse;

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ApiProblemDetails {
  status?: number;
  title?: string;
  detail?: string;
  code?: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
}

/**
 * `unavailable`: a session is stored on this device but the server could not confirm it (offline, server down).
 * Nothing private is accessible until it is confirmed; the credentials are kept and the restore is retried.
 */
export type AuthStatus = 'anonymous' | 'restoring' | 'authenticated' | 'unavailable';
