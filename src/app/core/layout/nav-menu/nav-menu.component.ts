import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavGroup, NavGroupId, NavItem } from '../../navigation/navigation.models';

/**
 * Grouped menu with collapsible groups, used by the side menu (wide screens) and the drop-down panel (tablets and
 * phones). A single group is shown as a plain list.
 */
@Component({
  selector: 'app-nav-menu',
  imports: [RouterLink],
  templateUrl: './nav-menu.component.html',
  styleUrl: './nav-menu.component.scss',
})
export class NavMenuComponent {
  readonly groups = input.required<readonly NavGroup[]>();
  readonly activeItemId = input<string | null>(null);
  readonly expandedGroupIds = input.required<ReadonlySet<NavGroupId>>();
  /** Keeps the ids of the group lists unique when the menu is rendered twice. */
  readonly idPrefix = input('nav');

  readonly groupToggle = output<NavGroupId>();
  readonly itemSelect = output<NavItem>();

  isExpanded(groupId: NavGroupId): boolean {
    return this.expandedGroupIds().has(groupId);
  }

  containsActive(group: NavGroup): boolean {
    const activeId = this.activeItemId();
    return activeId !== null && group.items.some((item) => item.id === activeId);
  }

  listId(groupId: NavGroupId): string {
    return `${this.idPrefix()}-group-${groupId}`;
  }
}
