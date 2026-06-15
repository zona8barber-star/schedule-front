import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import {
  AuthResponse,
  AuthStatus,
  AuthUserResponse,
  LoginRequest,
  type RegisterRequest,
  type RoleName,
  ROLE_NAMES,
} from '../models/auth.models';
import { getApiErrorMessage } from '../utils/api-error.utils';
import { AuthApiService } from './auth-api.service';

// Non-sensitive flag indicating an active session exists (actual tokens never touch localStorage).
// Avoids a network round-trip on page load for anonymous users.
const sessionFlagStorageKey = 'barbershop.auth.session';

// Refresh token en localStorage: fallback para iOS standalone donde las cookies
// cross-origin son bloqueadas por ITP. El backend lo acepta también desde el body.
const refreshTokenStorageKey = 'barbershop.auth.rt';

// Legacy keys — kept only for cleanup of values written by older app versions.
const legacyAccessTokenKey = 'barbershop.auth.accessToken';
const legacyRefreshTokenKey = 'barbershop.auth.refreshToken';

const authEntryPaths = new Set(['/auth/login', '/auth/register']);

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authApiService = inject(AuthApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  private bootstrapPromise: Promise<void> | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  private readonly currentUserState = signal<AuthUserResponse | null>(null);
  private readonly accessTokenState = signal<string | null>(null);
  private readonly statusState = signal<AuthStatus>(
    this.readStorage(sessionFlagStorageKey) ? 'restoring' : 'anonymous',
  );
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly accessToken = this.accessTokenState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly isLoading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly roles = computed<readonly RoleName[]>(() => this.currentUserState()?.roles ?? []);
  readonly isAuthenticated = computed(
    () => this.statusState() === 'authenticated' && this.currentUserState() !== null,
  );

  async bootstrap(): Promise<void> {
    await this.ensureInitialized();
  }

  async ensureInitialized(): Promise<void> {
    this.bootstrapPromise ??= this.initializeSession();
    await this.bootstrapPromise;
  }

  async register(request: RegisterRequest): Promise<AuthUserResponse> {
    return this.authenticate(() => this.authApiService.register(request));
  }

  async login(request: LoginRequest): Promise<AuthUserResponse> {
    return this.authenticate(() => this.authApiService.login(request));
  }

  async logout(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      if (this.accessTokenState()) {
        await firstValueFrom(this.authApiService.logout());
      }
    } catch {
      // The local session should still be cleared even if the server call fails.
    } finally {
      this.clearSession(true);
      this.loadingState.set(false);
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshSession();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  handleUnauthorized(): void {
    this.clearSession(true);
  }

  clearError(): void {
    this.errorState.set(null);
  }

  hasRole(role: RoleName): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: readonly RoleName[]): boolean {
    return roles.some((role) => this.hasRole(role));
  }

  resolvePostAuthUrl(returnUrl?: string | null): string {
    const normalizedReturnUrl = this.normalizeReturnUrl(returnUrl);
    if (normalizedReturnUrl) {
      return normalizedReturnUrl;
    }

    if (this.hasRole(ROLE_NAMES.admin)) {
      return '/admin/staff';
    }

    if (this.hasRole(ROLE_NAMES.staff)) {
      return '/staff/profile';
    }

    if (this.hasRole(ROLE_NAMES.customer)) {
      return '/customer/appointments';
    }

    return '/';
  }

  private normalizeReturnUrl(returnUrl?: string | null): string | null {
    if (!returnUrl?.startsWith('/')) {
      return null;
    }

    try {
      const parsed = new URL(returnUrl, 'http://localhost');

      if (parsed.origin !== 'http://localhost' || authEntryPaths.has(parsed.pathname)) {
        return null;
      }

      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  private async initializeSession(): Promise<void> {
    if (!this.readStorage(sessionFlagStorageKey)) {
      this.clearSession(true);
      return;
    }

    this.loadingState.set(true);
    this.statusState.set('restoring');

    try {
      const newToken = await this.refreshAccessToken();
      if (!newToken) {
        this.clearSession(true);
      }
      // refreshAccessToken → applySession already sets currentUser + status = 'authenticated'
    } finally {
      this.loadingState.set(false);
    }
  }

  private async authenticate(
    requestFactory: () => Observable<AuthResponse>,
  ): Promise<AuthUserResponse> {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const response = await firstValueFrom(requestFactory());
      this.applySession(response);
      return response.user;
    } catch (error) {
      this.errorState.set(getApiErrorMessage(error));
      throw error;
    } finally {
      this.loadingState.set(false);
    }
  }

  private async refreshSession(): Promise<string | null> {
    try {
      const storedRefreshToken = this.readStorage(refreshTokenStorageKey);
      const response = await firstValueFrom(this.authApiService.refresh(storedRefreshToken));
      this.applySession(response);
      return response.accessToken;
    } catch {
      this.handleUnauthorized();
      return null;
    }
  }

  private applySession(response: AuthResponse): void {
    this.accessTokenState.set(response.accessToken);
    this.currentUserState.set(response.user);
    this.statusState.set('authenticated');
    this.errorState.set(null);

    this.writeStorage(sessionFlagStorageKey, '1');

    if (response.refreshToken) {
      this.writeStorage(refreshTokenStorageKey, response.refreshToken);
    }
  }

  private clearSession(clearError = false): void {
    this.currentUserState.set(null);
    this.accessTokenState.set(null);
    this.statusState.set('anonymous');

    this.writeStorage(sessionFlagStorageKey, null);
    this.writeStorage(refreshTokenStorageKey, null);
    // Remove any tokens written by older versions of the app.
    this.writeStorage(legacyAccessTokenKey, null);
    this.writeStorage(legacyRefreshTokenKey, null);

    if (clearError) {
      this.errorState.set(null);
    }
  }

  private readStorage(key: string): string | null {
    if (!this.browser) {
      return null;
    }

    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string | null): void {
    if (!this.browser) {
      return;
    }

    try {
      if (value) {
        globalThis.localStorage.setItem(key, value);
      } else {
        globalThis.localStorage.removeItem(key);
      }
    } catch {
      // Keep in-memory session state even if browser storage is unavailable.
    }
  }
}
