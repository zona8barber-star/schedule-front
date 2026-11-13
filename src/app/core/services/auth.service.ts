import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';

import {
  AuthResponse,
  AuthStatus,
  AuthUserResponse,
  LoginRequest,
  type PermissionCode,
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

// Web Lock shared by every tab of the app: a refresh token can be used once (the server rotates it), so tabs take
// turns instead of racing with the same token.
const refreshLockName = 'barbershop.auth.refresh';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authApiService = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  private bootstrapPromise: Promise<void> | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private readonly beforeLogoutHooks: Array<() => Promise<void>> = [];

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
  // `?? []` also covers responses from an API version that did not send permissions yet.
  readonly permissions = computed<readonly string[]>(() => this.currentUserState()?.permissions ?? []);
  readonly isAuthenticated = computed(
    () => this.statusState() === 'authenticated' && this.currentUserState() !== null,
  );

  constructor() {
    if (!this.browser) {
      return;
    }

    // BUG-013: another tab signed out (or its session was rejected): this tab must not keep showing private data.
    const onStorage = (event: StorageEvent) => {
      if ((event.key === sessionFlagStorageKey || event.key === null) && !this.readStorage(sessionFlagStorageKey)) {
        this.endSessionFromAnotherTab();
      }
    };

    // BUG-014: the session could not be checked (offline, server down); try again as soon as the network is back.
    const onOnline = () => {
      if (this.statusState() === 'unavailable') {
        void this.retryRestore();
      }
    };

    globalThis.addEventListener?.('storage', onStorage);
    globalThis.addEventListener?.('online', onOnline);
    inject(DestroyRef).onDestroy(() => {
      globalThis.removeEventListener?.('storage', onStorage);
      globalThis.removeEventListener?.('online', onOnline);
    });
  }

  async bootstrap(): Promise<void> {
    await this.ensureInitialized();
  }

  async ensureInitialized(): Promise<void> {
    // A restore that failed for a transient reason is attempted again on the next check.
    if (this.statusState() === 'unavailable') {
      this.bootstrapPromise = null;
    }

    this.bootstrapPromise ??= this.initializeSession();
    await this.bootstrapPromise;
  }

  /** Tries again to restore a session that could not be checked before (e.g. the device was offline). */
  async retryRestore(): Promise<boolean> {
    await this.ensureInitialized();
    return this.isAuthenticated();
  }

  async register(request: RegisterRequest): Promise<AuthUserResponse> {
    return this.authenticate(() => this.authApiService.register(request));
  }

  async login(request: LoginRequest): Promise<AuthUserResponse> {
    return this.authenticate(() => this.authApiService.login(request));
  }

  /**
   * Registers work that must run while the session is still valid, right before logging out
   * (e.g. unlinking this device's push subscription from the account). Hooks must not throw.
   */
  registerBeforeLogout(hook: () => Promise<void>): void {
    this.beforeLogoutHooks.push(hook);
  }

  async logout(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      if (this.accessTokenState()) {
        await Promise.allSettled(this.beforeLogoutHooks.map((hook) => hook()));
        // Also the stored token: on iOS standalone the cookie does not reach the server.
        await firstValueFrom(this.authApiService.logout(this.readStorage(refreshTokenStorageKey)));
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

  /** Continues with a session the server just issued outside login/refresh (e.g. after changing the password). */
  adoptSession(response: AuthResponse): void {
    this.applySession(response);
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

  hasPermission(permission: PermissionCode): boolean {
    return this.permissions().includes(permission);
  }

  hasAnyPermission(permissions: readonly PermissionCode[]): boolean {
    return permissions.some((permission) => this.hasPermission(permission));
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

  /**
   * A path of this app to come back to after signing in, with its query string and fragment (SONDA BUG-064), or
   * null. Anything else (another origin, "//host", backslashes, encoded slashes that the router would read as an
   * empty segment such as "/%2F%2Fevil.example", the sign-in pages) falls back to the destination by role
   * (SONDA BUG-011).
   */
  private normalizeReturnUrl(returnUrl?: string | null): string | null {
    if (!returnUrl?.startsWith('/') || returnUrl.startsWith('//') || returnUrl.includes('\\')) {
      return null;
    }

    try {
      const parsed = new URL(returnUrl, 'http://localhost');
      if (parsed.origin !== 'http://localhost') {
        return null;
      }

      const segments = parsed.pathname.split('/').slice(1).map((segment) => decodeURIComponent(segment));
      if (segments.length > 1 && segments[segments.length - 1] === '') {
        segments.pop(); // a trailing slash is harmless
      }
      const isRoot = segments.length === 1 && segments[0] === '';
      const hasUnsafeSegment = segments.some(
        (segment) =>
          segment === '' || /[/\\]/.test(segment) || [...segment].some((character) => character.charCodeAt(0) < 0x20),
      );
      if ((!isRoot && hasUnsafeSegment) || authEntryPaths.has(`/${segments.join('/')}`)) {
        return null;
      }

      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      // Malformed percent-encoding.
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
      // A transient failure leaves the status 'unavailable' and keeps the stored credentials (BUG-014): nothing
      // private is shown until the server confirms the session, but the user is not asked for the password again.
      if (!newToken && this.statusState() !== 'unavailable') {
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

  private refreshSession(): Promise<string | null> {
    return this.withRefreshLock(async () => {
      // Read inside the lock: another tab may have just rotated the token.
      const sentRefreshToken = this.readStorage(refreshTokenStorageKey);

      try {
        return await this.requestRefresh(sentRefreshToken);
      } catch (error) {
        if (isTransientFailure(error)) {
          return this.keepSessionForLater();
        }

        // Browsers without Web Locks: another tab may have rotated the token while this request was in flight.
        // Its newer token (and cookie) is still valid, so try once with it instead of closing the session that
        // tab just renewed.
        const latestRefreshToken = this.readStorage(refreshTokenStorageKey);
        if (latestRefreshToken && latestRefreshToken !== sentRefreshToken) {
          try {
            return await this.requestRefresh(latestRefreshToken);
          } catch (retryError) {
            if (isTransientFailure(retryError)) {
              return this.keepSessionForLater();
            }
          }
        }

        // Only the server saying the session is no longer valid ends it.
        this.handleUnauthorized();
        return null;
      }
    });
  }

  /**
   * The refresh failed for a reason unrelated to the session (no network, server down, rate limit): the stored
   * credentials are kept. While restoring, the status becomes 'unavailable' (nothing private is accessible yet);
   * an already open session keeps its state and the next request retries.
   */
  private keepSessionForLater(): null {
    if (this.statusState() !== 'authenticated') {
      this.currentUserState.set(null);
      this.accessTokenState.set(null);
      this.statusState.set('unavailable');
    }

    return null;
  }

  /** Mirrors a sign-out done in another tab: memory only (that tab already cleared the storage). */
  private endSessionFromAnotherTab(): void {
    if (this.statusState() === 'anonymous') {
      return;
    }

    this.currentUserState.set(null);
    this.accessTokenState.set(null);
    this.statusState.set('anonymous');
    this.bootstrapPromise = null;

    const currentUrl = this.router.url;
    if (isPrivateRoute(this.router.routerState.snapshot.root)) {
      void this.router.navigate(['/auth/login'], { queryParams: { returnUrl: currentUrl } });
    }
  }

  private async requestRefresh(refreshToken: string | null): Promise<string> {
    const response = await firstValueFrom(this.authApiService.refresh(refreshToken));
    this.applySession(response);
    return response.accessToken;
  }

  /** Runs `work` while holding the cross-tab refresh lock, or directly where Web Locks are not available. */
  private withRefreshLock<T>(work: () => Promise<T>): Promise<T> {
    const locks = this.browser ? globalThis.navigator?.locks : undefined;
    if (!locks?.request) {
      return work();
    }

    return locks.request(refreshLockName, () => work()) as Promise<T>;
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

/** Errors that say nothing about the session: no connection, timeouts, rate limit or server failures. */
function isTransientFailure(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }

  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

/** Whether the current route is guarded for signed-in users (every guarded route except sign-in/registration). */
function isPrivateRoute(root: ActivatedRouteSnapshot): boolean {
  let node: ActivatedRouteSnapshot | null = root;
  while (node) {
    const guarded = (node.routeConfig?.canActivate?.length ?? 0) > 0;
    const path = `/${node.routeConfig?.path ?? ''}`;
    if (guarded && !authEntryPaths.has(path)) {
      return true;
    }

    node = node.firstChild;
  }

  return false;
}
