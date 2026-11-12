import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { AuthResponse } from '../models/auth.models';
import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';

const refreshTokenKey = 'barbershop.auth.rt';
const sessionFlagKey = 'barbershop.auth.session';

@Component({ template: '' })
class StubPageComponent {}

function session(refreshToken: string): AuthResponse {
  return {
    accessToken: `access-${refreshToken}`,
    expiresInSeconds: 3600,
    refreshToken,
    user: {
      id: 'user-1',
      fullName: 'Usuario',
      email: 'usuario@example.com',
      phoneNumber: null,
      roles: ['Customer'],
      profilePhotoId: null,
      profilePhotoUrl: null,
      permissions: [],
    },
  };
}

const failWith = (status: number): Observable<never> =>
  throwError(() => new HttpErrorResponse({ status }));

/**
 * SONDA BUG-014 (a transient failure of the refresh must not end the session) and the client side of BUG-013
 * (signing out in one tab ends the session in the others).
 */
describe('AuthService availability and cross-tab sign-out', () => {
  let api: {
    login: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    globalThis.localStorage.clear();
    api = { login: vi.fn(), logout: vi.fn(() => of(undefined)), refresh: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApiService, useValue: api },
        provideRouter([
          { path: '', component: StubPageComponent },
          { path: 'privado', component: StubPageComponent, canActivate: [() => true] },
          { path: 'auth/login', component: StubPageComponent, canActivate: [() => true] },
        ]),
      ],
    });
  });

  afterEach(() => globalThis.localStorage.clear());

  function storeSession(): void {
    globalThis.localStorage.setItem(sessionFlagKey, '1');
    globalThis.localStorage.setItem(refreshTokenKey, 'rt-1');
  }

  it.each([0, 502, 503, 504, 429])(
    'keeps the stored session when restoring fails with status %s, without granting access',
    async (status) => {
      storeSession();
      api.refresh.mockReturnValue(failWith(status));
      const service = TestBed.inject(AuthService);

      await service.ensureInitialized();

      expect(service.status()).toBe('unavailable');
      expect(service.isAuthenticated()).toBe(false);
      expect(service.accessToken()).toBeNull();
      expect(globalThis.localStorage.getItem(refreshTokenKey)).toBe('rt-1');
      expect(globalThis.localStorage.getItem(sessionFlagKey)).toBe('1');
    },
  );

  it('ends the session when the server rejects the refresh token', async () => {
    storeSession();
    api.refresh.mockReturnValue(failWith(401));
    const service = TestBed.inject(AuthService);

    await service.ensureInitialized();

    expect(service.status()).toBe('anonymous');
    expect(globalThis.localStorage.getItem(refreshTokenKey)).toBeNull();
    expect(globalThis.localStorage.getItem(sessionFlagKey)).toBeNull();
  });

  it('restores the session on the next check once the server answers again, without the password', async () => {
    storeSession();
    api.refresh.mockReturnValueOnce(failWith(503)).mockReturnValueOnce(of(session('rt-2')));
    const service = TestBed.inject(AuthService);
    await service.ensureInitialized();

    await service.ensureInitialized();

    expect(service.isAuthenticated()).toBe(true);
    expect(api.refresh).toHaveBeenNthCalledWith(2, 'rt-1');
    expect(globalThis.localStorage.getItem(refreshTokenKey)).toBe('rt-2');
    expect(api.login).not.toHaveBeenCalled();
  });

  it('retries by itself when the network comes back', async () => {
    storeSession();
    api.refresh.mockReturnValueOnce(failWith(0)).mockReturnValueOnce(of(session('rt-2')));
    const service = TestBed.inject(AuthService);
    await service.ensureInitialized();

    globalThis.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(service.isAuthenticated()).toBe(true));
  });

  it('keeps an open session when a refresh in the middle of it fails for a transient reason', async () => {
    api.login.mockReturnValue(of(session('rt-1')));
    api.refresh.mockReturnValue(failWith(503));
    const service = TestBed.inject(AuthService);
    await service.login({ email: 'usuario@example.com', password: 'Secret123!' });

    const token = await service.refreshAccessToken();

    expect(token).toBeNull();
    expect(service.isAuthenticated()).toBe(true);
    expect(globalThis.localStorage.getItem(refreshTokenKey)).toBe('rt-1');
  });

  it('signs this tab out and leaves a private page when another tab signs out', async () => {
    api.login.mockReturnValue(of(session('rt-1')));
    const service = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    await service.login({ email: 'usuario@example.com', password: 'Secret123!' });
    await router.navigateByUrl('/privado');

    // The other tab cleared the storage; this one only receives the event.
    globalThis.localStorage.removeItem(sessionFlagKey);
    globalThis.dispatchEvent(new StorageEvent('storage', { key: sessionFlagKey, newValue: null }));
    await vi.waitFor(() => expect(router.url).toBe('/auth/login?returnUrl=%2Fprivado'));

    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
  });

  it('stays on a public page when another tab signs out', async () => {
    api.login.mockReturnValue(of(session('rt-1')));
    const service = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    await service.login({ email: 'usuario@example.com', password: 'Secret123!' });
    await router.navigateByUrl('/');

    globalThis.localStorage.removeItem(sessionFlagKey);
    globalThis.dispatchEvent(new StorageEvent('storage', { key: sessionFlagKey, newValue: null }));
    await TestBed.inject(Router).navigated;

    expect(service.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/');
  });

  it('ignores storage events that do not end the session', async () => {
    api.login.mockReturnValue(of(session('rt-1')));
    const service = TestBed.inject(AuthService);
    await service.login({ email: 'usuario@example.com', password: 'Secret123!' });

    globalThis.localStorage.setItem(refreshTokenKey, 'rt-rotated');
    globalThis.dispatchEvent(
      new StorageEvent('storage', { key: refreshTokenKey, newValue: 'rt-rotated' }),
    );

    expect(service.isAuthenticated()).toBe(true);
  });
});
