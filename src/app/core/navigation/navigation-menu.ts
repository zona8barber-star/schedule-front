import { PERMISSION_CODES, PermissionCode, ROLE_NAMES } from '../models/auth.models';
import {
  NavAccess,
  NavContext,
  NavGroup,
  NavGroupDefinition,
  NavItem,
  NavItemDefinition,
  NavigationMenu,
  NavShortcut,
} from './navigation.models';

const PUBLIC: NavAccess = { kind: 'public' };
const AUTHENTICATED: NavAccess = { kind: 'authenticated' };
const CUSTOMER: NavAccess = { kind: 'roles', roles: [ROLE_NAMES.customer] };
const STAFF: NavAccess = { kind: 'roles', roles: [ROLE_NAMES.staff] };
const ADMIN: NavAccess = { kind: 'roles', roles: [ROLE_NAMES.admin] };

const permissions = (...codes: PermissionCode[]): NavAccess => ({
  kind: 'permissions',
  permissions: codes,
});

/**
 * The single definition of the app menu: groups, order, labels and who sees each link. Only existing routes belong
 * here; a new page gets its entry once it exists. The header, the side menu, the phone panel, the shortcut bar and
 * the account menu are all built from this list.
 */
export const NAVIGATION_GROUPS: readonly NavGroupDefinition[] = [
  {
    id: 'explore',
    label: 'Explorar',
    kind: 'personal',
    // The public pages are the starting point of visitors and customers; staff and back-office users reach the
    // home page from the logo.
    visibleWhen: (context) => !context.isAuthenticated || context.roles.includes(ROLE_NAMES.customer),
    items: [
      { id: 'home', label: 'Inicio', route: '/', exact: true, access: PUBLIC },
      {
        id: 'booking',
        label: 'Reservar',
        route: '/booking',
        access: PUBLIC,
        shortcut: { order: 20, icon: 'booking' },
      },
      {
        id: 'staff-directory',
        label: 'Profesionales',
        route: '/staff',
        access: PUBLIC,
        shortcut: { order: 90, icon: 'staff' },
      },
      // The public product catalog (ADR-0016 B6), also reachable from a printed QR.
      { id: 'product-catalog', label: 'Productos', route: '/productos', access: PUBLIC },
    ],
  },
  {
    id: 'customer',
    label: 'Mi actividad',
    kind: 'personal',
    items: [
      {
        id: 'customer-appointments',
        label: 'Mis citas',
        route: '/customer/appointments',
        access: CUSTOMER,
        shortcut: { order: 30, icon: 'appointments' },
      },
      { id: 'customer-memberships', label: 'Mis membresías', route: '/customer/memberships', access: CUSTOMER },
      {
        id: 'customer-loyalty',
        label: 'Mis puntos',
        route: '/customer/loyalty',
        access: CUSTOMER,
        shortcut: { order: 70, icon: 'points' },
      },
      { id: 'customer-reviews', label: 'Mis reseñas', route: '/customer/reviews', access: CUSTOMER },
    ],
  },
  {
    id: 'my-work',
    label: 'Mi trabajo',
    kind: 'work',
    items: [
      {
        id: 'staff-appointments',
        label: 'Mi agenda',
        route: '/staff/appointments',
        access: STAFF,
        shortcut: { order: 10, icon: 'appointments' },
      },
      { id: 'staff-availability', label: 'Mi disponibilidad', route: '/staff/availability', access: STAFF },
      {
        // By permission and an active professional profile, not by role: an administrator who also works as a
        // professional registers their services too.
        id: 'staff-service-records',
        label: 'Servicios realizados',
        route: '/staff/service-records',
        access: {
          kind: 'permissions',
          permissions: [PERMISSION_CODES.serviceRecordsRegister],
          requiresServiceRecordEligibility: true,
        },
        shortcut: { order: 40, icon: 'records', label: 'Registrar' },
      },
    ],
  },
  {
    id: 'operation',
    label: 'Operación',
    kind: 'back-office',
    items: [
      {
        id: 'admin-appointments',
        label: 'Citas',
        route: '/admin/appointments',
        access: ADMIN,
        shortcut: { order: 50, icon: 'appointments', label: 'Citas' },
      },
      {
        id: 'admin-service-records',
        label: 'Servicios por aprobar',
        route: '/admin/service-records',
        access: permissions(PERMISSION_CODES.serviceRecordsApprove),
        shortcut: { order: 60, icon: 'records', label: 'Por aprobar' },
      },
      { id: 'admin-staff', label: 'Gestión de profesionales', route: '/admin/staff', access: ADMIN },
    ],
  },
  {
    id: 'customers',
    label: 'Clientes',
    kind: 'back-office',
    items: [
      {
        id: 'admin-customers',
        label: 'Clientes',
        route: '/admin/customers',
        // A sold membership is opened from its customer.
        alsoActiveOn: ['/admin/memberships'],
        access: ADMIN,
        shortcut: { order: 80, icon: 'customers' },
      },
      {
        id: 'admin-customer-claims',
        label: 'Reclamaciones de clientes',
        route: '/admin/customer-claims',
        access: permissions(PERMISSION_CODES.customerClaimsApprove),
      },
    ],
  },
  {
    id: 'catalogs',
    label: 'Catálogos',
    kind: 'back-office',
    items: [
      { id: 'admin-service-categories', label: 'Categorías de servicio', route: '/admin/service-categories', access: ADMIN },
      { id: 'admin-general-services', label: 'Servicios generales', route: '/admin/general-services', access: ADMIN },
      { id: 'admin-services', label: 'Tarifas de liquidación', route: '/admin/services', access: ADMIN },
      { id: 'admin-product-categories', label: 'Categorías de productos', route: '/admin/product-categories', access: ADMIN },
      { id: 'admin-products', label: 'Productos', route: '/admin/products', access: ADMIN },
      { id: 'admin-membership-plans', label: 'Planes de membresía', route: '/admin/membership-plans', access: ADMIN },
    ],
  },
  {
    id: 'loyalty',
    label: 'Fidelización',
    kind: 'back-office',
    items: [
      {
        id: 'admin-loyalty-settings',
        label: 'Configuración del programa',
        route: '/admin/loyalty',
        access: permissions(PERMISSION_CODES.loyaltySettingsManage),
      },
      {
        id: 'admin-loyalty-rewards',
        label: 'Recompensas',
        route: '/admin/loyalty/rewards',
        access: permissions(PERMISSION_CODES.loyaltyRewardsManage),
      },
      {
        id: 'admin-loyalty-redemptions',
        label: 'Canjes de puntos',
        route: '/admin/loyalty/redemptions',
        access: permissions(PERMISSION_CODES.loyaltyRedemptionsApprove, PERMISSION_CODES.loyaltyRedemptionsDeliver),
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finanzas',
    kind: 'back-office',
    items: [
      { id: 'admin-income', label: 'Ingresos', route: '/admin/income', access: ADMIN },
      { id: 'admin-expenses', label: 'Gastos', route: '/admin/expenses', access: ADMIN },
      { id: 'admin-reports', label: 'Reportes', route: '/admin/reports', access: ADMIN },
    ],
  },
  {
    id: 'content',
    label: 'Contenido',
    kind: 'back-office',
    items: [
      { id: 'admin-landing', label: 'Landing', route: '/admin/content/landing', access: ADMIN },
      { id: 'admin-banners', label: 'Banners', route: '/admin/content/banners', access: ADMIN },
      { id: 'admin-ticker', label: 'Ticker', route: '/admin/content/ticker-items', access: ADMIN },
      {
        id: 'admin-business-hours',
        label: 'Horario de atención',
        route: '/admin/content/business-hours',
        access: ADMIN,
      },
      { id: 'admin-notifications', label: 'Avisos a clientes', route: '/admin/notifications', access: ADMIN },
    ],
  },
  {
    id: 'administration',
    label: 'Administración',
    kind: 'back-office',
    items: [
      { id: 'admin-users', label: 'Usuarios', route: '/admin/users', access: ADMIN },
      { id: 'admin-roles', label: 'Roles', route: '/admin/roles', access: ADMIN },
    ],
  },
  {
    id: 'account',
    label: 'Mi cuenta',
    kind: 'account',
    items: [
      { id: 'customer-profile', label: 'Mi perfil', route: '/customer/profile', access: CUSTOMER },
      {
        id: 'customer-customer-profile',
        label: 'Mi perfil de cliente',
        route: '/customer/customer-profile',
        access: CUSTOMER,
      },
      { id: 'staff-profile', label: 'Mi perfil profesional', route: '/staff/profile', access: STAFF },
      { id: 'account-notifications', label: 'Notificaciones', route: '/account/notifications', access: AUTHENTICATED },
    ],
  },
];

/** "Inicio" always opens the shortcut bar, whoever is signed in. */
const HOME_SHORTCUT: NavShortcut = { id: 'home', label: 'Inicio', route: '/', exact: true, icon: 'home' };
const MAX_SHORTCUTS = 4;

export function canAccess(access: NavAccess, context: NavContext): boolean {
  switch (access.kind) {
    case 'public':
      return true;
    case 'authenticated':
      return context.isAuthenticated;
    case 'roles':
      return context.isAuthenticated && access.roles.some((role) => context.roles.includes(role));
    case 'permissions':
      return (
        context.isAuthenticated &&
        access.permissions.some((permission) => context.permissions.includes(permission)) &&
        (!access.requiresServiceRecordEligibility || context.canRegisterServiceRecords)
      );
  }
}

export function buildNavigation(
  context: NavContext,
  definitions: readonly NavGroupDefinition[] = NAVIGATION_GROUPS,
): NavigationMenu {
  const visibleGroups: NavGroup[] = [];
  const shortcutCandidates: { order: number; shortcut: NavShortcut }[] = [];

  for (const definition of definitions) {
    if (definition.visibleWhen && !definition.visibleWhen(context)) {
      continue;
    }

    const items = definition.items
      .filter((item) => canAccess(item.access, context))
      .map((item) => toNavItem(item, definition.id));

    // A group the user cannot use at all is not shown.
    if (items.length === 0) {
      continue;
    }

    visibleGroups.push({ id: definition.id, label: definition.label, kind: definition.kind, items });

    for (const item of definition.items) {
      if (item.shortcut && canAccess(item.access, context)) {
        shortcutCandidates.push({
          order: item.shortcut.order,
          shortcut: {
            id: item.id,
            label: item.shortcut.label ?? item.label,
            route: item.route,
            exact: item.exact ?? false,
            icon: item.shortcut.icon,
          },
        });
      }
    }
  }

  const groups = visibleGroups.filter((group) => group.kind !== 'account');
  const accountItems = visibleGroups.find((group) => group.kind === 'account')?.items ?? [];

  const shortcuts = [
    HOME_SHORTCUT,
    ...shortcutCandidates.sort((left, right) => left.order - right.order).map((candidate) => candidate.shortcut),
  ].slice(0, MAX_SHORTCUTS);

  const layout = groups.some((group) => group.kind === 'work' || group.kind === 'back-office') ? 'sidebar' : 'header';

  return { groups, accountItems, shortcuts, layout };
}

/** Path of a router URL, without query string, fragment or trailing slash. */
export function normalizeNavigationPath(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? '';
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return trimmed === '' ? '/' : trimmed;
}

/**
 * The one item that represents the current path: the longest route that matches it, so "/admin/loyalty/rewards"
 * activates "Recompensas" and not also "Configuración del programa". Returns null when no item matches.
 */
export function resolveActiveItemId(
  items: readonly Pick<NavItem, 'id' | 'route' | 'exact' | 'alsoActiveOn'>[],
  url: string,
): string | null {
  const path = normalizeNavigationPath(url);
  let best: { id: string; length: number } | null = null;

  for (const item of items) {
    const routes = [item.route, ...item.alsoActiveOn];
    for (const route of routes) {
      if (!matchesRoute(path, route, item.exact)) {
        continue;
      }
      if (!best || route.length > best.length) {
        best = { id: item.id, length: route.length };
      }
    }
  }

  return best?.id ?? null;
}

function matchesRoute(path: string, route: string, exact: boolean): boolean {
  if (path === route) {
    return true;
  }
  if (exact || route === '/') {
    return false;
  }
  return path.startsWith(`${route}/`);
}

function toNavItem(item: NavItemDefinition, groupId: NavGroup['id']): NavItem {
  return {
    id: item.id,
    label: item.label,
    route: item.route,
    exact: item.exact ?? false,
    alsoActiveOn: item.alsoActiveOn ?? [],
    groupId,
  };
}
