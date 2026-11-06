import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { ServiceRecordEligibilityService } from '../services/service-record-eligibility.service';
import { buildNavigation, normalizeNavigationPath, resolveActiveItemId } from './navigation-menu';
import { NavContext, NavGroupId, NavItem, NavigationMenu } from './navigation.models';

/**
 * State of the app menu for the signed-in user: the visible groups, the single active item, the page title and
 * which groups are expanded. The side menu and the phone panel share it, so both show the same open groups.
 */
@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private readonly authService = inject(AuthService);
  private readonly serviceRecordEligibility = inject(ServiceRecordEligibilityService);
  private readonly router = inject(Router);

  readonly currentPath = signal(normalizeNavigationPath(this.router.url));
  readonly pageTitle = signal('');

  private readonly context = computed<NavContext>(() => ({
    isAuthenticated: this.authService.isAuthenticated(),
    roles: this.authService.roles(),
    permissions: this.authService.permissions(),
    canRegisterServiceRecords: this.serviceRecordEligibility.canRegister(),
  }));

  readonly menu = computed<NavigationMenu>(() => buildNavigation(this.context()));

  private readonly allItems = computed<readonly NavItem[]>(() => {
    const menu = this.menu();
    return [...menu.groups.flatMap((group) => group.items), ...menu.accountItems];
  });

  /** The only active item, across the main menu and the account menu. */
  readonly activeItemId = computed(() => resolveActiveItemId(this.allItems(), this.currentPath()));

  readonly activeGroupId = computed<NavGroupId | null>(() => {
    const activeId = this.activeItemId();
    return this.allItems().find((item) => item.id === activeId)?.groupId ?? null;
  });

  readonly isAccountItemActive = computed(() => this.activeGroupId() === 'account');

  private readonly expandedGroupIdsState = signal<ReadonlySet<NavGroupId>>(new Set());
  readonly expandedGroupIds = this.expandedGroupIdsState.asReadonly();

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.currentPath.set(normalizeNavigationPath(event.urlAfterRedirects));
        this.pageTitle.set(this.resolvePageTitle());
      });

    // The group that holds the current page opens by itself; the others keep whatever the user chose.
    effect(() => {
      const groupId = this.activeGroupId();
      if (groupId) {
        untracked(() => this.expandGroup(groupId));
      }
    });
  }

  isGroupExpanded(groupId: NavGroupId): boolean {
    return this.expandedGroupIdsState().has(groupId);
  }

  toggleGroup(groupId: NavGroupId): void {
    this.expandedGroupIdsState.update((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  private expandGroup(groupId: NavGroupId): void {
    if (this.expandedGroupIdsState().has(groupId)) {
      return;
    }
    this.expandedGroupIdsState.update((current) => new Set(current).add(groupId));
  }

  private resolvePageTitle(): string {
    let snapshot: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let title = '';
    while (snapshot) {
      title = snapshot.title ?? title;
      snapshot = snapshot.firstChild;
    }
    return title;
  }
}
