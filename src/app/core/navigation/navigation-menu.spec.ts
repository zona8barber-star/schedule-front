import { Route } from '@angular/router';

import { routes } from '../../app.routes';
import { authGuard } from '../guards/auth.guard';
import { permissionGuard } from '../guards/permission.guard';
import { roleGuard } from '../guards/role.guard';
import { PERMISSION_CODES, ROLE_NAMES } from '../models/auth.models';
import {
  NAVIGATION_GROUPS,
  buildNavigation,
  normalizeNavigationPath,
  resolveActiveItemId,
} from './navigation-menu';
import { NavContext, NavigationMenu } from './navigation.models';
import { customerClaimsQueryGuard } from '../../features/admin/customer-claims/customer-claims-query.guard';

const URL_ONLY_GUARDS: unknown[] = [customerClaimsQueryGuard];

const ALL_PERMISSIONS = Object.values(PERMISSION_CODES);

const anonymous: NavContext = {
  isAuthenticated: false,
  roles: [],
  permissions: [],
  canRegisterServiceRecords: false,
};

const customer: NavContext = {
  isAuthenticated: true,
  roles: [ROLE_NAMES.customer],
  permissions: [],
  canRegisterServiceRecords: false,
};

const staff: NavContext = {
  isAuthenticated: true,
  roles: [ROLE_NAMES.staff],
  permissions: [PERMISSION_CODES.serviceRecordsRegister],
  canRegisterServiceRecords: true,
};

const fullAdmin: NavContext = {
  isAuthenticated: true,
  roles: [ROLE_NAMES.admin],
  permissions: ALL_PERMISSIONS,
  canRegisterServiceRecords: false,
};

const adminWhoIsAlsoProfessional: NavContext = {
  isAuthenticated: true,
  roles: [ROLE_NAMES.admin, ROLE_NAMES.staff],
  permissions: ALL_PERMISSIONS,
  canRegisterServiceRecords: true,
};

// A custom role with no system role: only what its permissions open.
const receptionist: NavContext = {
  isAuthenticated: true,
  roles: ['Recepción'],
  permissions: [PERMISSION_CODES.serviceRecordsApprove, PERMISSION_CODES.loyaltyRedemptionsDeliver],
  canRegisterServiceRecords: false,
};

function itemIdsByGroup(menu: NavigationMenu): Record<string, string[]> {
  return Object.fromEntries(menu.groups.map((group) => [group.id, group.items.map((item) => item.id)]));
}

function allMenuItems(menu: NavigationMenu) {
  return [...menu.groups.flatMap((group) => group.items), ...menu.accountItems];
}

describe('buildNavigation', () => {
  it('shows a visitor only the public pages, flat in the header, with three shortcuts', () => {
    const menu = buildNavigation(anonymous);

    expect(itemIdsByGroup(menu)).toEqual({ explore: ['home', 'booking', 'staff-directory', 'product-catalog'] });
    expect(menu.accountItems).toEqual([]);
    expect(menu.layout).toBe('header');
    expect(menu.shortcuts.map((shortcut) => shortcut.id)).toEqual(['home', 'booking', 'staff-directory']);
  });

  it('gives a customer the public pages and their own activity, profiles in the account menu', () => {
    const menu = buildNavigation(customer);

    expect(itemIdsByGroup(menu)).toEqual({
      explore: ['home', 'booking', 'staff-directory', 'product-catalog'],
      customer: ['customer-appointments', 'customer-memberships', 'customer-loyalty', 'customer-reviews'],
    });
    expect(menu.accountItems.map((item) => item.id)).toEqual([
      'customer-profile',
      'customer-customer-profile',
      'account-notifications',
    ]);
    expect(menu.layout).toBe('header');
    expect(menu.shortcuts.map((shortcut) => shortcut.id)).toEqual([
      'home',
      'booking',
      'customer-appointments',
      'customer-loyalty',
    ]);
  });

  it('gives a professional only their work, and the side menu', () => {
    const menu = buildNavigation(staff);

    expect(itemIdsByGroup(menu)).toEqual({
      'my-work': ['staff-appointments', 'staff-availability', 'staff-service-records'],
    });
    expect(menu.accountItems.map((item) => item.id)).toEqual(['staff-profile', 'account-notifications']);
    expect(menu.layout).toBe('sidebar');
    expect(menu.shortcuts.map((shortcut) => shortcut.id)).toEqual([
      'home',
      'staff-appointments',
      'staff-service-records',
    ]);
  });

  it('hides "Servicios realizados" from a professional without an active professional profile', () => {
    const menu = buildNavigation({ ...staff, canRegisterServiceRecords: false });

    expect(itemIdsByGroup(menu)['my-work']).toEqual(['staff-appointments', 'staff-availability']);
  });

  it('gives an administrator with every permission all the back-office groups, in order', () => {
    const menu = buildNavigation(fullAdmin);

    expect(menu.groups.map((group) => group.label)).toEqual([
      'Operación',
      'Clientes',
      'Catálogos',
      'Fidelización',
      'Finanzas',
      'Contenido',
      'Administración',
    ]);
    expect(itemIdsByGroup(menu)).toEqual({
      operation: ['admin-appointments', 'admin-service-records', 'admin-staff'],
      customers: ['admin-customers', 'admin-customer-claims'],
      catalogs: [
        'admin-service-categories',
        'admin-general-services',
        'admin-services',
        'admin-product-categories',
        'admin-products',
        'admin-membership-plans',
      ],
      loyalty: ['admin-loyalty-settings', 'admin-loyalty-rewards', 'admin-loyalty-redemptions'],
      finance: ['admin-income', 'admin-expenses', 'admin-reports'],
      content: ['admin-landing', 'admin-banners', 'admin-ticker', 'admin-business-hours', 'admin-notifications'],
      administration: ['admin-users', 'admin-roles'],
    });
    expect(menu.accountItems.map((item) => item.id)).toEqual(['account-notifications']);
    expect(menu.layout).toBe('sidebar');
    expect(menu.shortcuts.map((shortcut) => shortcut.id)).toEqual([
      'home',
      'admin-appointments',
      'admin-service-records',
      'admin-customers',
    ]);
  });

  it('adds "Mi trabajo" before the back-office groups for an administrator who is also a professional', () => {
    const menu = buildNavigation(adminWhoIsAlsoProfessional);

    expect(menu.groups.map((group) => group.id)).toEqual([
      'my-work',
      'operation',
      'customers',
      'catalogs',
      'loyalty',
      'finance',
      'content',
      'administration',
    ]);
    expect(itemIdsByGroup(menu)['my-work']).toEqual([
      'staff-appointments',
      'staff-availability',
      'staff-service-records',
    ]);
    expect(menu.accountItems.map((item) => item.id)).toEqual(['staff-profile', 'account-notifications']);
    expect(menu.shortcuts.map((shortcut) => shortcut.id)).toEqual([
      'home',
      'staff-appointments',
      'staff-service-records',
      'admin-appointments',
    ]);
  });

  it('shows "Servicios realizados" to an administrator with a professional profile but without the Staff role', () => {
    const menu = buildNavigation({ ...fullAdmin, canRegisterServiceRecords: true });

    expect(itemIdsByGroup(menu)['my-work']).toEqual(['staff-service-records']);
  });

  it('gives a custom role only the items of its permissions and hides the empty groups', () => {
    const menu = buildNavigation(receptionist);

    expect(itemIdsByGroup(menu)).toEqual({
      operation: ['admin-service-records'],
      loyalty: ['admin-loyalty-redemptions'],
    });
    expect(menu.accountItems.map((item) => item.id)).toEqual(['account-notifications']);
    expect(menu.layout).toBe('sidebar');
    expect(menu.shortcuts.map((shortcut) => shortcut.id)).toEqual(['home', 'admin-service-records']);
  });

  it('ignores permissions and roles of a session that is not authenticated', () => {
    const menu = buildNavigation({ ...fullAdmin, isAuthenticated: false });

    expect(itemIdsByGroup(menu)).toEqual({ explore: ['home', 'booking', 'staff-directory', 'product-catalog'] });
  });
});

describe('resolveActiveItemId', () => {
  const adminItems = allMenuItems(buildNavigation(adminWhoIsAlsoProfessional));
  const customerItems = allMenuItems(buildNavigation(customer));

  it.each([
    ['/admin/loyalty', 'admin-loyalty-settings'],
    ['/admin/loyalty/rewards', 'admin-loyalty-rewards'],
    ['/admin/loyalty/redemptions?status=Pending', 'admin-loyalty-redemptions'],
    ['/admin/customers/5b1c', 'admin-customers'],
    ['/admin/memberships/9f2e', 'admin-customers'],
    ['/admin/expenses/fixed', 'admin-expenses'],
    ['/admin/staff/12/availability', 'admin-staff'],
    ['/admin/products', 'admin-products'],
    ['/admin/product-categories', 'admin-product-categories'],
    ['/staff/profile', 'staff-profile'],
    ['/staff/appointments/', 'staff-appointments'],
    ['/account/notifications#top', 'account-notifications'],
  ])('marks only one item for %s', (url, expected) => {
    expect(resolveActiveItemId(adminItems, url)).toBe(expected);
  });

  it.each([
    ['/', 'home'],
    ['/booking/confirm?staffProfileId=1', 'booking'],
    ['/staff', 'staff-directory'],
    ['/staff/0f9a', 'staff-directory'],
    ['/productos', 'product-catalog'],
    ['/productos/ceras001/cera0001', 'product-catalog'],
    ['/customer/memberships/77', 'customer-memberships'],
    ['/customer/profile', 'customer-profile'],
  ])('resolves %s for a customer', (url, expected) => {
    expect(resolveActiveItemId(customerItems, url)).toBe(expected);
  });

  it('returns null for a page outside the menu instead of falling back to "Inicio"', () => {
    expect(resolveActiveItemId(customerItems, '/auth/login')).toBeNull();
    expect(resolveActiveItemId(adminItems, '/')).toBeNull();
  });

  it('does not take a route as the prefix of a longer word', () => {
    expect(resolveActiveItemId(adminItems, '/admin/servicesx')).toBeNull();
  });
});

describe('normalizeNavigationPath', () => {
  it('drops the query, the fragment and a trailing slash', () => {
    expect(normalizeNavigationPath('/admin/income?date=2026-11-06#x')).toBe('/admin/income');
    expect(normalizeNavigationPath('/admin/income/')).toBe('/admin/income');
    expect(normalizeNavigationPath('')).toBe('/');
    expect(normalizeNavigationPath('/')).toBe('/');
  });
});

describe('NAVIGATION_GROUPS', () => {
  const definedItems = NAVIGATION_GROUPS.flatMap((group) => group.items);

  function findRoute(route: string): Route | undefined {
    const path = route.replace(/^\//, '');
    return routes.find((candidate) => candidate.path === path && !candidate.redirectTo);
  }

  it('only links to existing routes', () => {
    const missing = definedItems.filter((item) => !findRoute(item.route)).map((item) => item.route);

    expect(missing).toEqual([]);
  });

  it('uses unique ids and routes', () => {
    const ids = definedItems.map((item) => item.id);
    const paths = definedItems.map((item) => item.route);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it.each(definedItems.map((item) => [item.route, item] as const))(
    'grants %s to the same users as its route guard',
    (_route, item) => {
      const route = findRoute(item.route)!;
      // Guards that only keep the URL canonical do not decide access, so they are left out of the comparison.
      const guards = (route.canActivate ?? []).filter((guard) => !URL_ONLY_GUARDS.includes(guard));
      const data = route.data ?? {};

      switch (item.access.kind) {
        case 'public':
          expect(guards).toEqual([]);
          break;
        case 'authenticated':
          expect(guards).toEqual([authGuard]);
          break;
        case 'roles':
          expect(guards).toEqual([authGuard, roleGuard]);
          expect(data['roles']).toEqual(item.access.roles);
          break;
        case 'permissions':
          expect(guards).toEqual([authGuard, permissionGuard]);
          expect(data['permissions']).toEqual(item.access.permissions);
          break;
      }
    },
  );
});
