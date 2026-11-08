import { PermissionCode, RoleName } from '../models/auth.models';

/** Groups of the main menu, in display order, plus the account menu. */
export type NavGroupId =
  | 'explore'
  | 'customer'
  | 'my-work'
  | 'operation'
  | 'customers'
  | 'catalogs'
  | 'loyalty'
  | 'finance'
  | 'content'
  | 'administration'
  | 'account';

export type NavShortcutIcon =
  | 'home'
  | 'booking'
  | 'staff'
  | 'appointments'
  | 'records'
  | 'points'
  | 'customers';

/**
 * Who may see an item. It mirrors the guard of the route it links to (a spec checks that they agree), so the menu
 * never offers a page the guard would refuse.
 */
export type NavAccess =
  | { readonly kind: 'public' }
  | { readonly kind: 'authenticated' }
  | { readonly kind: 'roles'; readonly roles: readonly RoleName[] }
  | {
      readonly kind: 'permissions';
      readonly permissions: readonly PermissionCode[];
      /** Also needs the user's own active professional profile (service-records.register). */
      readonly requiresServiceRecordEligibility?: boolean;
    };

export interface NavItemDefinition {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  /** Only the exact path activates the item (used by "/"). */
  readonly exact?: boolean;
  /** Other paths that belong to this item, e.g. a detail page reached from it. */
  readonly alsoActiveOn?: readonly string[];
  readonly access: NavAccess;
  /** Candidate for the phone shortcut bar; lower order goes first. */
  readonly shortcut?: { readonly order: number; readonly icon: NavShortcutIcon; readonly label?: string };
}

export type NavGroupKind = 'personal' | 'work' | 'back-office' | 'account';

export interface NavGroupDefinition {
  readonly id: NavGroupId;
  readonly label: string;
  readonly kind: NavGroupKind;
  readonly items: readonly NavItemDefinition[];
  /** Extra condition for the whole group, on top of each item's access. */
  readonly visibleWhen?: (context: NavContext) => boolean;
}

export interface NavContext {
  readonly isAuthenticated: boolean;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly canRegisterServiceRecords: boolean;
}

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  readonly exact: boolean;
  readonly alsoActiveOn: readonly string[];
  readonly groupId: NavGroupId;
}

export interface NavGroup {
  readonly id: NavGroupId;
  readonly label: string;
  readonly kind: NavGroupKind;
  readonly items: readonly NavItem[];
}

export interface NavShortcut {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  readonly exact: boolean;
  readonly icon: NavShortcutIcon;
}

export interface NavigationMenu {
  /** Visible groups of the main menu, without empty ones. */
  readonly groups: readonly NavGroup[];
  /** Personal links of the account menu (profiles, notification settings). */
  readonly accountItems: readonly NavItem[];
  /** Phone shortcut bar, "Inicio" first. */
  readonly shortcuts: readonly NavShortcut[];
  /** Work or back-office groups get a side menu on wide screens; the rest fit in the header. */
  readonly layout: 'sidebar' | 'header';
}
