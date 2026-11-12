import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { AuthStatus } from '../models/auth.models';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const api = 'http://api.test/api/v1';

/**
 * BUG-013 deploy compatibility: an access token issued before sessions were tracked (no "sid") is rejected with 401.
 * The app must renew with the refresh token it already holds and repeat the request, without signing the user out.
 */
describe('authInterceptor recovery from a rejected access token', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: {
    accessToken: ReturnType<typeof signal<string | null>>;
    status: ReturnType<typeof signal<AuthStatus>>;
    refreshAccessToken: ReturnType<typeof vi.fn>;
    handleUnauthorized: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth = {
      accessToken: signal<string | null>('access-without-sid'),
      status: signal<AuthStatus>('authenticated'),
      refreshAccessToken: vi.fn(),
      handleUnauthorized: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: RuntimeConfigService, useValue: { config: signal({ apiBaseUrl: api }) } },
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('renews and repeats the request with the new access token', async () => {
    auth.refreshAccessToken.mockImplementation(async () => {
      auth.accessToken.set('access-with-sid');
      return 'access-with-sid';
    });

    const result = firstValueFrom(http.get<{ ok: boolean }>(`${api}/customer/profile`));

    const first = backend.expectOne(`${api}/customer/profile`);
    expect(first.request.headers.get('Authorization')).toBe('Bearer access-without-sid');
    first.flush(null, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1));
    const retry = await vi.waitFor(() => backend.expectOne(`${api}/customer/profile`));
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-with-sid');
    retry.flush({ ok: true });

    await expect(result).resolves.toEqual({ ok: true });
    expect(auth.handleUnauthorized).not.toHaveBeenCalled();
  });

  it('gives up without repeating when the session cannot be renewed', async () => {
    auth.refreshAccessToken.mockResolvedValue(null);

    const result = firstValueFrom(http.get(`${api}/customer/profile`));
    backend
      .expectOne(`${api}/customer/profile`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    backend.expectNone(`${api}/customer/profile`);
  });

  it('does not try to renew a request that already used a renewed token', async () => {
    auth.refreshAccessToken.mockImplementation(async () => 'access-with-sid');

    const result = firstValueFrom(http.get(`${api}/customer/profile`));
    backend
      .expectOne(`${api}/customer/profile`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    const retry = await vi.waitFor(() => backend.expectOne(`${api}/customer/profile`));
    retry.flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
  });
});
