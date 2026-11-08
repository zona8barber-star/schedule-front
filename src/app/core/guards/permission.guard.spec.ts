import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { PERMISSION_CODES, PermissionCode } from '../models/auth.models';
import { AuthService } from '../services/auth.service';
import { permissionGuard } from './permission.guard';

describe('permissionGuard', () => {
  let authenticated: boolean;
  let granted: PermissionCode[];
  let authService: {
    ensureInitialized: ReturnType<typeof vi.fn>;
    isAuthenticated: () => boolean;
    hasAnyPermission: (codes: readonly PermissionCode[]) => boolean;
    resolvePostAuthUrl: () => string;
  };

  beforeEach(() => {
    authenticated = true;
    granted = [];
    authService = {
      ensureInitialized: vi.fn(() => Promise.resolve()),
      isAuthenticated: () => authenticated,
      hasAnyPermission: (codes) => codes.some((code) => granted.includes(code)),
      resolvePostAuthUrl: () => '/customer/appointments',
    };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    });
  });

  function run(permissions: readonly PermissionCode[] | undefined, url = '/admin/loyalty') {
    const route = { data: permissions ? { permissions } : {} } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => permissionGuard(route, state)) as Promise<
      boolean | UrlTree
    >;
  }

  function serialize(result: boolean | UrlTree): string {
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : String(result);
  }

  it('waits for the session before deciding', async () => {
    granted = [PERMISSION_CODES.loyaltySettingsManage];

    await run([PERMISSION_CODES.loyaltySettingsManage]);

    expect(authService.ensureInitialized).toHaveBeenCalled();
  });

  it('allows a user holding the required permission', async () => {
    granted = [PERMISSION_CODES.loyaltySettingsManage];

    expect(await run([PERMISSION_CODES.loyaltySettingsManage])).toBe(true);
  });

  it('allows a user holding any one of several permissions', async () => {
    granted = [PERMISSION_CODES.serviceRecordsApprove];

    expect(
      await run([PERMISSION_CODES.serviceRecordsRegister, PERMISSION_CODES.serviceRecordsApprove]),
    ).toBe(true);
  });

  it('redirects a user without the permission to their home page', async () => {
    granted = [PERMISSION_CODES.salesRegister];

    const result = await run([PERMISSION_CODES.loyaltyPointsAdjust]);

    expect(serialize(result)).toBe('/customer/appointments');
  });

  it('sends an anonymous visitor to login, keeping where they wanted to go', async () => {
    authenticated = false;

    const result = await run([PERMISSION_CODES.loyaltySettingsManage], '/admin/loyalty/settings');

    expect(serialize(result)).toBe('/auth/login?returnUrl=%2Fadmin%2Floyalty%2Fsettings');
  });

  it('lets an authenticated user through a route that requires no permission', async () => {
    expect(await run(undefined)).toBe(true);
    expect(await run([])).toBe(true);
  });
});
