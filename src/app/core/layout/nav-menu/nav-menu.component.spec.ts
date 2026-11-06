import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NavGroup, NavGroupId, NavItem } from '../../navigation/navigation.models';
import { NavMenuComponent } from './nav-menu.component';

function item(id: string, groupId: NavGroupId, route = `/${id}`): NavItem {
  return { id, label: id.toUpperCase(), route, exact: false, alsoActiveOn: [], groupId };
}

const GROUPS: NavGroup[] = [
  { id: 'operation', label: 'Operación', kind: 'back-office', items: [item('citas', 'operation'), item('aprobar', 'operation')] },
  { id: 'finance', label: 'Finanzas', kind: 'back-office', items: [item('ingresos', 'finance')] },
];

@Component({ template: '' })
class PageStubComponent {}

describe('NavMenuComponent', () => {
  let fixture: ComponentFixture<NavMenuComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavMenuComponent],
      providers: [provideRouter([{ path: '**', component: PageStubComponent }])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavMenuComponent);
    element = fixture.nativeElement as HTMLElement;
  });

  async function render(groups: NavGroup[], expanded: NavGroupId[], activeItemId: string | null): Promise<void> {
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('expandedGroupIds', new Set(expanded));
    fixture.componentRef.setInput('activeItemId', activeItemId);
    fixture.componentRef.setInput('idPrefix', 'test');
    await fixture.whenStable();
  }

  function toggles(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('.nav-menu__toggle'));
  }

  it('renders each group as a button that controls its list, open only when expanded', async () => {
    await render(GROUPS, ['operation'], null);

    const [operation, finance] = toggles();
    expect(operation.textContent).toContain('Operación');
    expect(operation.getAttribute('aria-expanded')).toBe('true');
    expect(operation.getAttribute('aria-controls')).toBe('test-group-operation');
    expect(element.querySelector<HTMLElement>('#test-group-operation')!.hidden).toBe(false);

    expect(finance.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector<HTMLElement>('#test-group-finance')!.hidden).toBe(true);
  });

  it('emits the group to toggle when its heading is pressed', async () => {
    await render(GROUPS, [], null);
    const toggled: NavGroupId[] = [];
    fixture.componentInstance.groupToggle.subscribe((groupId) => toggled.push(groupId));

    toggles()[1].click();

    expect(toggled).toEqual(['finance']);
  });

  it('marks exactly one link as the current page and highlights its group', async () => {
    await render(GROUPS, ['operation', 'finance'], 'aprobar');

    const current = element.querySelectorAll('[aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].getAttribute('data-nav-item')).toBe('aprobar');
    expect(current[0].classList).toContain('is-active');
    expect(element.querySelector('[data-nav-group="operation"]')!.classList).toContain('nav-menu__group--current');
    expect(element.querySelector('[data-nav-group="finance"]')!.classList).not.toContain('nav-menu__group--current');
  });

  it('emits the selected item so the panel can close', async () => {
    await render(GROUPS, ['finance'], null);
    const selected: string[] = [];
    fixture.componentInstance.itemSelect.subscribe((navItem) => selected.push(navItem.id));

    element.querySelector<HTMLAnchorElement>('[data-nav-item="ingresos"]')!.click();

    expect(selected).toEqual(['ingresos']);
  });

  it('shows a single group as a plain list, without a collapsible heading', async () => {
    await render([GROUPS[0]], [], 'citas');

    expect(toggles().length).toBe(0);
    expect(element.querySelectorAll('.nav-menu__link').length).toBe(2);
    expect(element.querySelector('[aria-current="page"]')!.getAttribute('data-nav-item')).toBe('citas');
  });
});
