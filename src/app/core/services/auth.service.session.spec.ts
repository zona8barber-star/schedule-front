import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { AuthResponse } from '../models/auth.models';
import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';

const refreshTokenKey = 'barbershop.auth.rt';
const sessionFlagKey = 'barbershop.auth.session';

function session(refreshToken: string, accessToken = `access-${refreshToken}`): AuthResponse {
  return {
    accessToken,
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

const unauthorized = () => throwError(() => new HttpErrorResponse({ status: 401 }));

/**
 * SONDA BUG-002 and BUG-016 on the client: logout must send the stored refresh token (iOS standalone has no
 * cookie), and since the server now lets a refresh token be used only once, tabs must take turns and a tab that
 * lost the race must not close the session another tab just renewed.
 */
describe('AuthService session lifecycle', () => {
  let api: {
    login: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    globalThis.localStorage.clear();
    api = { login: vi.fn(), logout: vi.fn(() => of(undefined)), refresh: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: AuthApiService, useValue: api }] });
  });

  afterEach(() => {
    globalThis.localStorage.clear();
    Reflect.deleteProperty(globalThis.navigator, 'locks');
  });

  function useWebLocks(beforeGrant?: () => void) {
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) => {
      beforeGrant?.();
      return callback();
    });
    Object.defineProperty(globalThis.navigator, 'locks', {
      value: { request },
      configurable: true,
    });
    return request;
  }

  it('sends the stored refresh token when logging out, for clients without the cookie', async () => {
    api.login.mockReturnValue(of(session('rt-1')));
    const service = TestBed.inject(AuthService);
    await service.login({ email: 'usuario@example.com', password: 'Secret123!' });

    await service.logout();

    expect(api.logout).toHaveBeenCalledWith('rt-1');
    expect(globalThis.localStorage.getItem(refreshTokenKey)).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('still clears the local session when the logout request fails', async () => {
    api.login.mockReturnValue(of(session('rt-1')));
    api.logout.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const service = TestBed.inject(AuthService);
    await service.login({ email: 'usuario@example.com', password: 'Secret123!' });

    await service.logout();

    expect(globalThis.localStorage.getItem(refreshTokenKey)).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('refreshes inside the shared cross-tab lock and reads the token once it holds it', async () => {
    globalThis.localStorage.setItem(refreshTokenKey, 'rt-old');
    // Another tab rotated the token while this one waited for the lock.
    const lock = useWebLocks(() =>
      globalThis.localStorage.setItem(refreshTokenKey, 'rt-rotated-by-other-tab'),
    );
    api.refresh.mockReturnValue(of(session('rt-next')));
    const service = TestBed.inject(AuthService);

    const token = await service.refreshAccessToken();

    expect(lock).toHaveBeenCalledWith('barbershop.auth.refresh', expect.any(Function));
    expect(api.refresh).toHaveBeenCalledWith('rt-rotated-by-other-tab');
    expect(token).toBe('access-rt-next');
    expect(globalThis.localStorage.getItem(refreshTokenKey)).toBe('rt-next');
  });

  it('keeps the session another tab renewed when its own refresh loses the race (no Web Locks)', async () => {
    globalThis.localStorage.setItem(sessionFlagKey, '1');
    globalThis.localStorage.setItem(refreshTokenKey, 'rt-1');
    api.refresh
      .mockReturnValueOnce(
        new Observable<AuthResponse>((subscriber) => {
          // The other tab's rotation lands first; this request then gets 401 for the consumed token.
          globalThis.localStorage.setItem(refreshTokenKey, 'rt-2');
          subscriber.error(new HttpErrorResponse({ status: 401 }));
        }),
      )
      .mockReturnValueOnce(of(session('rt-3')));
    const service = TestBed.inject(AuthService);

    const token = await service.refreshAccessToken();

    expect(api.refresh).toHaveBeenNthCalledWith(1, 'rt-1');
    expect(api.refresh).toHaveBeenNthCalledWith(2, 'rt-2');
    expect(token).toBe('access-rt-3');
    expect(service.isAuthenticated()).toBe(true);
    expect(globalThis.localStorage.getItem(sessionFlagKey)).toBe('1');
  });

  it('closes the session when the refresh is rejected and no other tab renewed it', async () => {
    globalThis.localStorage.setItem(sessionFlagKey, '1');
    globalThis.localStorage.setItem(refreshTokenKey, 'rt-1');
    api.refresh.mockReturnValue(unauthorized());
    const service = TestBed.inject(AuthService);

    const token = await service.refreshAccessToken();

    expect(token).toBeNull();
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(globalThis.localStorage.getItem(refreshTokenKey)).toBeNull();
    expect(globalThis.localStorage.getItem(sessionFlagKey)).toBeNull();
  });

  it('adopts the session issued after a password change', () => {
    globalThis.localStorage.setItem(refreshTokenKey, 'rt-revoked');
    const service = TestBed.inject(AuthService);

    service.adoptSession(session('rt-after-change'));

    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('access-rt-after-change');
    expect(globalThis.localStorage.getItem(refreshTokenKey)).toBe('rt-after-change');
  });
});
