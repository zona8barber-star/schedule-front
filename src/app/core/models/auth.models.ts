export const ROLE_NAMES = {
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

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
