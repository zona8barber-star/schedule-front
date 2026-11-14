import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationError, Router, provideRouter } from '@angular/router';
import { NavigationFailureService } from '../../services/navigation-failure.service';
import { provideServiceWorker } from '@angular/service-worker';

import { AuthUserResponse, PERMISSION_CODES, ROLE_NAMES } from '../../models/auth.models';
import { NavigationService } from '../../navigation/navigation.service';
import { AuthService } from '../../services/auth.service';
import { ServiceRecordEligibilityService } from '../../services/service-record-eligibility.service';
import { AppShellComponent } from './app-shell.component';

@Component({ template: '<p>página</p>' })
class PageStubComponent {}

const page = (path: string, title: string) => ({ path, component: PageStubComponent, title });

const TEST_ROUTES = [
  page('', 'Zona 8'),
  page('auth/login', 'Iniciar sesión'),
  page('booking', 'Reservar'),
  page('staff', 'Profesionales'),
  page('customer/appointments', 'Mis citas'),
  page('customer/profile', 'Mi perfil'),
  page('staff/appointments', 'Agenda'),
  page('staff/profile', 'Mi perfil'),
  page('admin/appointments', 'Citas'),
  page('admin/loyalty', 'Fidelización'),
  page('admin/loyalty/rewards', 'Recompensas'),
  page('admin/income', 'Ingresos'),
  page('admin/customers/:customerId', 'Cliente'),
  page('account/notifications', 'Notificaciones'),
];

class FakeAuthService {
  readonly currentUser = signal<AuthUserResponse | null>(null);
  readonly status = signal<'ready' | 'restoring'>('ready');
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly roles = computed(() => this.currentUser()?.roles ?? []);
  readonly permissions = computed(() => this.currentUser()?.permissions ?? []);
  readonly logout = vi.fn(async () => this.currentUser.set(null));
  registerBeforeLogout(): void {}
}

function user(roles: string[], permissions: string[] = []): AuthUserResponse {
  return {
    id: 'user-1',
    fullName: 'Ana Prueba',
    email: 'ana@example.com',
    phoneNumber: null,
    roles: roles as AuthUserResponse['roles'],
    profilePhotoId: null,
    profilePhotoUrl: null,
    permissions,
  };
}

describe('AppShellComponent navigation', () => {
  const originalMatchMedia = window.matchMedia;
  const originalResizeObserver = globalThis.ResizeObserver;

  let fixture: ComponentFixture<AppShellComponent>;
  let element: HTMLElement;
  let router: Router;
  let auth: FakeAuthService;
  let canRegister: ReturnType<typeof signal<boolean>>;

  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
  });

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
    globalThis.ResizeObserver = originalResizeObserver;
  });

  beforeEach(async () => {
    auth = new FakeAuthService();
    canRegister = signal(false);

    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter(TEST_ROUTES),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideServiceWorker('ngsw-worker.js', { enabled: false }),
        { provide: AuthService, useValue: auth },
        { provide: ServiceRecordEligibilityService, useValue: { canRegister: canRegister.asReadonly() } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  async function renderAt(url: string): Promise<void> {
    fixture = TestBed.createComponent(AppShellComponent);
    element = fixture.nativeElement as HTMLElement;
    await router.navigateByUrl(url);
    await fixture.whenStable();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  function sidebar(): HTMLElement | null {
    return element.querySelector('[data-testid="sidebar"]');
  }

  function panel(): HTMLElement | null {
    return element.querySelector('[data-testid="mobile-panel"]');
  }

  /** Current-page links of the menus (header, side menu, panel); the shortcut bar is a separate list. */
  function menuCurrentItems(): NodeListOf<Element> {
    return element.querySelectorAll(
      '.app-shell__header [aria-current="page"], [data-testid="sidebar"] [aria-current="page"], [data-testid="mobile-panel"] [aria-current="page"]',
    );
  }

  function toggleButton(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('[data-testid="menu-toggle"]')!;
  }

  it('gives a full administrator the grouped side menu, with the current group open and one active item', async () => {
    auth.currentUser.set(user([ROLE_NAMES.admin], Object.values(PERMISSION_CODES)));
    await renderAt('/admin/loyalty/rewards');

    const side = sidebar()!;
    const headings = Array.from(side.querySelectorAll('.nav-menu__toggle')).map((button) => button.textContent!.trim());
    expect(headings).toEqual([
      'Operación',
      'Clientes',
      'Catálogos',
      'Fidelización',
      'Finanzas',
      'Contenido',
      'Administración',
    ]);

    const expanded = Array.from(side.querySelectorAll('.nav-menu__toggle[aria-expanded="true"]')).map((button) =>
      button.textContent!.trim(),
    );
    expect(expanded).toEqual(['Fidelización']);

    const current = menuCurrentItems();
    expect(Array.from(current).map((link) => link.getAttribute('data-nav-item'))).toEqual(['admin-loyalty-rewards']);

    // The header carries the title, not the list of links.
    expect(element.querySelector('.app-shell__header-nav')).toBeNull();
    expect(element.querySelector('[data-testid="page-title"]')!.textContent!.trim()).toBe('Recompensas');
  });

  it('opens the group of the new page when navigating, keeping the groups the user opened', async () => {
    auth.currentUser.set(user([ROLE_NAMES.admin], Object.values(PERMISSION_CODES)));
    await renderAt('/admin/appointments');

    const navigation = TestBed.inject(NavigationService);
    navigation.toggleGroup('content');
    await router.navigateByUrl('/admin/income');
    await settle();

    expect(navigation.isGroupExpanded('operation')).toBe(true);
    expect(navigation.isGroupExpanded('content')).toBe(true);
    expect(navigation.isGroupExpanded('finance')).toBe(true);
    expect(navigation.activeItemId()).toBe('admin-income');
  });

  it('adds "Mi trabajo" for an administrator who is also a professional and keeps one active item', async () => {
    auth.currentUser.set(
      user([ROLE_NAMES.admin, ROLE_NAMES.staff], Object.values(PERMISSION_CODES)),
    );
    canRegister.set(true);
    await renderAt('/staff/appointments');

    const headings = Array.from(sidebar()!.querySelectorAll('.nav-menu__toggle')).map((button) =>
      button.textContent!.trim(),
    );
    expect(headings[0]).toBe('Mi trabajo');
    expect(sidebar()!.querySelector('[data-nav-item="staff-service-records"]')).not.toBeNull();
    expect(Array.from(menuCurrentItems()).map((link) => link.getAttribute('data-nav-item'))).toEqual([
      'staff-appointments',
    ]);
  });

  it('shows a custom role only the groups its permissions open', async () => {
    auth.currentUser.set(user(['Recepción'], [PERMISSION_CODES.serviceRecordsApprove]));
    await renderAt('/admin/income');

    const headings = Array.from(sidebar()!.querySelectorAll('.nav-menu__toggle')).map((button) =>
      button.textContent!.trim(),
    );
    // A single visible group is shown as a plain list.
    expect(headings).toEqual([]);
    const links = Array.from(sidebar()!.querySelectorAll('[data-nav-item]')).map((link) =>
      link.getAttribute('data-nav-item'),
    );
    expect(links).toEqual(['admin-service-records']);
  });

  it('gives a customer header drop-downs instead of the side menu, and the profiles in the account menu', async () => {
    auth.currentUser.set(user([ROLE_NAMES.customer]));
    await renderAt('/customer/appointments');

    expect(sidebar()).toBeNull();
    const groupButtons = Array.from(element.querySelectorAll<HTMLButtonElement>('.app-shell__header-group-toggle'));
    expect(groupButtons.map((button) => button.textContent!.trim())).toEqual(['Explorar', 'Mi actividad']);
    expect(groupButtons[1].classList).toContain('is-active');

    groupButtons[1].click();
    await settle();
    const dropdownLinks = Array.from(element.querySelectorAll('.app-shell__header-dropdown [data-nav-item]')).map(
      (link) => link.getAttribute('data-nav-item'),
    );
    expect(dropdownLinks).toEqual([
      'customer-appointments',
      'customer-memberships',
      'customer-loyalty',
      'customer-reviews',
    ]);

    // Opening the account menu closes the group drop-down.
    element.querySelector<HTMLButtonElement>('[data-testid="account-toggle"]')!.click();
    await settle();
    expect(element.querySelector('.app-shell__header-dropdown')).toBeNull();
    const accountLinks = Array.from(element.querySelectorAll('#account-menu [data-nav-item]')).map((link) =>
      link.getAttribute('data-nav-item'),
    );
    expect(accountLinks).toEqual(['customer-profile', 'customer-customer-profile', 'account-notifications']);
  });

  // SONDA BUG-065: a page whose code could not be downloaded shows «Sin conexión» with «Reintentar», not a blank screen.
  it('shows the common offline state when a page cannot be opened', async () => {
    await renderAt('/');

    TestBed.inject(NavigationFailureService).report(
      new NavigationError(9, '/staff', new TypeError('Failed to fetch dynamically imported module: /chunk-X.js')),
    );
    await settle();

    expect(element.querySelector('[data-testid="load-error"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="load-error-retry"]')!.textContent).toContain('Reintentar');

    await router.navigateByUrl('/');
    await settle();
    expect(element.querySelector('[data-testid="load-error"]')).toBeNull();
  });

  it('shows a visitor the public links flat in the header and the sign-in link', async () => {
    await renderAt('/');

    const links = Array.from(element.querySelectorAll('.app-shell__header-nav [data-nav-item]')).map((link) =>
      link.getAttribute('data-nav-item'),
    );
    expect(links).toEqual(['home', 'booking', 'staff-directory', 'product-catalog']);
    expect(element.querySelector('a[href="/auth/login"]')!.textContent!.trim()).toBe('Ingresar');
    expect(element.querySelector('[data-testid="account-toggle"]')).toBeNull();
  });

  it('opens the grouped panel from the header, moves the focus into it and closes it with Escape', async () => {
    auth.currentUser.set(user([ROLE_NAMES.admin], Object.values(PERMISSION_CODES)));
    await renderAt('/admin/loyalty');

    expect(panel()).toBeNull();
    toggleButton().click();
    await settle();

    expect(panel()).not.toBeNull();
    expect(toggleButton().getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement?.getAttribute('data-nav-item')).toBe('admin-loyalty-settings');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();

    expect(panel()).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(toggleButton());
  });

  it('closes the panel when its backdrop is pressed or a link is followed', async () => {
    auth.currentUser.set(user([ROLE_NAMES.admin], Object.values(PERMISSION_CODES)));
    await renderAt('/admin/appointments');

    toggleButton().click();
    await settle();
    element.querySelector<HTMLButtonElement>('.app-shell__backdrop')!.click();
    await settle();
    expect(panel()).toBeNull();

    toggleButton().click();
    await settle();
    panel()!.querySelector<HTMLAnchorElement>('[data-nav-item="admin-income"]')!.click();
    await settle();

    expect(router.url).toBe('/admin/income');
    expect(panel()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('builds the shortcut bar from the same definition, with the current page highlighted', async () => {
    auth.currentUser.set(user([ROLE_NAMES.customer]));
    await renderAt('/customer/appointments');

    const shortcuts = Array.from(element.querySelectorAll('[data-testid="shortcut-bar"] [data-shortcut]'));
    expect(shortcuts.map((link) => link.getAttribute('data-shortcut'))).toEqual([
      'home',
      'booking',
      'customer-appointments',
      'customer-loyalty',
    ]);
    const current = shortcuts.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.getAttribute('data-shortcut'))).toEqual(['customer-appointments']);
  });

  it('signs out from the account menu', async () => {
    auth.currentUser.set(user([ROLE_NAMES.staff], [PERMISSION_CODES.serviceRecordsRegister]));
    await renderAt('/staff/profile');

    const accountToggle = element.querySelector<HTMLButtonElement>('[data-testid="account-toggle"]')!;
    // The account page is the active item, so the account button is highlighted instead of a menu link.
    expect(accountToggle.classList).toContain('is-active');
    accountToggle.click();
    await settle();
    element.querySelector<HTMLButtonElement>('.app-shell__user-dropdown-logout')!.click();
    await settle();

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a visitor on the landing', null, '/'],
    ['a visitor on the sign-in page', null, '/auth/login'],
    ['a customer on an account page', [ROLE_NAMES.customer], '/customer/profile'],
    ['an admin on a back-office page', [ROLE_NAMES.admin], '/admin/income'],
  ])('closes the page with exactly one site footer for %s', async (_case, roles, url) => {
    if (roles) {
      auth.currentUser.set(user(roles));
    }
    await renderAt(url);

    const footers = element.querySelectorAll('app-site-footer');
    expect(footers).toHaveLength(1);
    expect(element.querySelectorAll('footer')).toHaveLength(1);
    // Under the content, in the same column (beside the side menu on wide work layouts), never inside <main>.
    expect(footers[0].parentElement?.classList).toContain('app-shell__main');
    expect(element.querySelector('main app-site-footer')).toBeNull();
  });
});
