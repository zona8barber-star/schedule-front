export const ROLE_NAMES = {
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

// Mirrors the backend catalog (Barbershop.Domain.Users.PermissionCodes).
export const PERMISSION_CODES = {
  salesRegister: 'sales.register',
  serviceRecordsRegister: 'service-records.register',
  serviceRecordsApprove: 'service-records.approve',
  loyaltySettingsManage: 'loyalty.settings.manage',
  loyaltyRewardsManage: 'loyalty.rewards.manage',
  loyaltyRedemptionsApprove: 'loyalty.redemptions.approve',
  loyaltyRedemptionsDeliver: 'loyalty.redemptions.deliver',
  loyaltyPointsAdjust: 'loyalty.points.adjust',
  membershipPaymentsConfirm: 'memberships.payments.confirm',
  customerClaimsApprove: 'customers.claims.approve',
} as const;

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

export type AuthStatus = 'anonymous' | 'restoring' | 'authenticated';
