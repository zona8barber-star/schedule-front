import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthResponse, AuthUserResponse, PERMISSION_CODES } from '../models/auth.models';
import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';

function response(user: Partial<AuthUserResponse>): AuthResponse {
  return {
    accessToken: 'token',
    expiresInSeconds: 3600,
    refreshToken: null,
    user: {
      id: 'user-1',
      fullName: 'Usuario',
      email: 'usuario@example.com',
      phoneNumber: null,
      roles: ['Customer'],
      profilePhotoId: null,
      profilePhotoUrl: null,
      permissions: [],
      ...user,
    },
  };
}

describe('AuthService permissions', () => {
  let api: { login: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    globalThis.localStorage.clear();
    api = { login: vi.fn(), logout: vi.fn(() => of(undefined)) };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthApiService, useValue: api }],
    });
  });

  afterEach(() => globalThis.localStorage.clear());

  async function loginWith(user: Partial<AuthUserResponse>): Promise<AuthService> {
    api.login.mockReturnValue(of(response(user)));
    const service = TestBed.inject(AuthService);
    await service.login({ email: 'usuario@example.com', password: 'Secret123!' });
    return service;
  }

  it('mirrors the backend permission catalog', () => {
    expect(Object.values(PERMISSION_CODES).sort()).toEqual(
      [
        'customers.claims.approve',
        'loyalty.points.adjust',
        'loyalty.redemptions.approve',
        'loyalty.redemptions.deliver',
        'loyalty.rewards.manage',
        'loyalty.settings.manage',
        'memberships.payments.confirm',
        'sales.register',
        'service-records.approve',
        'service-records.register',
      ].sort(),
    );
  });

  it('keeps approving and delivering a redemption as separate permissions', async () => {
    const service = await loginWith({ permissions: [PERMISSION_CODES.loyaltyRedemptionsApprove] });

    expect(service.hasPermission(PERMISSION_CODES.loyaltyRedemptionsApprove)).toBe(true);
    expect(service.hasPermission(PERMISSION_CODES.loyaltyRedemptionsDeliver)).toBe(false);
  });

  it('has no permissions while anonymous', () => {
    const service = TestBed.inject(AuthService);

    expect(service.permissions()).toEqual([]);
    expect(service.hasPermission(PERMISSION_CODES.loyaltySettingsManage)).toBe(false);
  });

  it('exposes the permissions returned by the API', async () => {
    const service = await loginWith({
      roles: ['Customer'],
      permissions: [PERMISSION_CODES.loyaltySettingsManage, PERMISSION_CODES.loyaltyRewardsManage],
    });

    expect(service.hasPermission(PERMISSION_CODES.loyaltySettingsManage)).toBe(true);
    expect(service.hasPermission(PERMISSION_CODES.loyaltyPointsAdjust)).toBe(false);
    expect(
      service.hasAnyPermission([PERMISSION_CODES.loyaltyPointsAdjust, PERMISSION_CODES.loyaltyRewardsManage]),
    ).toBe(true);
    expect(service.hasAnyPermission([])).toBe(false);
  });

  it('does not treat the Admin role as a permission by itself', async () => {
    const service = await loginWith({ roles: ['Admin'], permissions: [] });

    expect(service.hasPermission(PERMISSION_CODES.serviceRecordsApprove)).toBe(false);
  });

  it('tolerates an older API response without permissions', async () => {
    const service = await loginWith({ permissions: undefined as unknown as string[] });

    expect(service.permissions()).toEqual([]);
    expect(service.hasPermission(PERMISSION_CODES.salesRegister)).toBe(false);
  });

  it('drops the permissions on logout', async () => {
    const service = await loginWith({ permissions: [PERMISSION_CODES.customerClaimsApprove] });

    await service.logout();

    expect(service.hasPermission(PERMISSION_CODES.customerClaimsApprove)).toBe(false);
  });
});
