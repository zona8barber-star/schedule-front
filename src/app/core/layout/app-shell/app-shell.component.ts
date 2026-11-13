import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, fromEvent, interval } from 'rxjs';

import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { NavMenuComponent } from '../nav-menu/nav-menu.component';
import { SiteFooterComponent } from '../site-footer/site-footer.component';
import { ToastOutletComponent } from '../../../shared/components/toast-outlet/toast-outlet.component';
import { BUSINESS_CONTACT } from '../../config/business-contact.config';
import {
  BUSINESS_SOCIAL_PROFILES,
  SOCIAL_PLATFORM_DEFINITIONS,
} from '../../config/business-social-links.config';
import { RuntimeConfigService } from '../../config/runtime-config.service';
import { NavGroupId } from '../../navigation/navigation.models';
import { NavigationService } from '../../navigation/navigation.service';
import { AuthService } from '../../services/auth.service';
import { ConnectivityService } from '../../services/connectivity.service';
import { HttpActivityService } from '../../services/http-activity.service';
import { InstallPromptService } from '../../services/install-prompt.service';
import { PublicContentApiService } from '../../services/public-content-api.service';
import { PublicBrandingStore } from '../../services/public-branding.store';
import { PushNotificationService } from '../../services/push-notification.service';
import { ToastService } from '../../services/toast.service';
import { TabHighlightStyle, computeTabHighlightStyle } from '../../utils/tab-highlight.utils';
import { whatsAppUrl } from '../../utils/whatsapp-link.utils';

interface FooterSocialLink {
  label: string;
  href: string;
  icon: string;
}

/** Width from which the side menu (or the header links) replace the drop-down panel. Mirrors the SCSS breakpoint. */
const WIDE_LAYOUT_MIN_WIDTH = 1024;

@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterOutlet,
    ToastOutletComponent,
    ConfirmModalComponent,
    NotificationBellComponent,
    NavMenuComponent,
    SiteFooterComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  readonly configService = inject(RuntimeConfigService);
  readonly authService = inject(AuthService);
  readonly navigation = inject(NavigationService);
  readonly httpActivityService = inject(HttpActivityService);
  readonly installPromptService = inject(InstallPromptService);
  readonly pushNotificationService = inject(PushNotificationService);
  readonly connectivityService = inject(ConnectivityService);

  private readonly swUpdate = inject(SwUpdate);
  private readonly toastService = inject(ToastService);
  private readonly publicContentApiService = inject(PublicContentApiService);
  /** SONDA BUG-100: name and logo configured in «Marca», with the static ones as fallback. */
  readonly brandingStore = inject(PublicBrandingStore);
  private readonly injector = inject(Injector);

  // Teléfono de contacto de la barbería, cargado una vez al iniciar el shell.
  // Alimenta el botón flotante de WhatsApp visible en toda la app.
  private readonly contactPhone = signal<string | null>(null);

  readonly whatsappUrl = computed<string | null>(() => whatsAppUrl(this.contactPhone()));

  readonly isSigningOut = signal(false);

  // The display mode only tunes page details (hidden footers, safe areas). The navigation follows the screen width
  // alone, so the browser and the installed app behave the same.
  private readonly standaloneQuery =
    globalThis.window !== undefined
      ? globalThis.window.matchMedia('(display-mode: standalone)')
      : null;

  private readonly tabletQuery =
    globalThis.window !== undefined
      ? globalThis.window.matchMedia('(min-width: 769px)')
      : null;

  readonly isStandalone = signal(this.standaloneQuery?.matches ?? false);
  readonly isTablet = signal(this.tabletQuery?.matches ?? false);

  readonly isInstallPrompting = signal(false);
  readonly isMobileMenuOpen = signal(false);
  readonly isUserMenuOpen = signal(false);
  readonly openHeaderGroupId = signal<NavGroupId | null>(null);

  readonly menu = this.navigation.menu;

  readonly isSidebarLayout = computed(() => this.menu().layout === 'sidebar');

  /** Header links on wide screens for visitors and customers: one group is shown flat, several as drop-downs. */
  readonly headerGroups = computed(() => (this.isSidebarLayout() ? [] : this.menu().groups));

  // Sliding "glass" highlight behind the active shortcut tab.
  private readonly bottomNav = viewChild<ElementRef<HTMLElement>>('bottomNav');
  private readonly bottomNavTabRefs = viewChildren<ElementRef<HTMLElement>>('bottomNavTab');
  private readonly menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');
  private readonly mobilePanel = viewChild<ElementRef<HTMLElement>>('mobilePanel');

  readonly activeShortcutIndex = computed<number | null>(() => {
    const shortcuts = this.menu().shortcuts;
    const activeId =
      this.navigation.currentPath() === '/' ? 'home' : this.navigation.activeItemId();
    const index = shortcuts.findIndex((shortcut) => shortcut.id === activeId);
    return index >= 0 ? index : null;
  });

  readonly bottomNavHighlightStyle = signal<TabHighlightStyle | null>(null);

  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly elementRef = inject(ElementRef);

  readonly identitySubtitle = computed(
    () => this.authService.currentUser()?.email ?? 'Cuenta activa',
  );

  readonly contactDetails = [
    BUSINESS_CONTACT.phone,
    BUSINESS_CONTACT.email,
    BUSINESS_CONTACT.address,
  ].filter((value): value is string => (value?.trim()?.length ?? 0) > 0);

  readonly socialLinks: FooterSocialLink[] = SOCIAL_PLATFORM_DEFINITIONS.map((definition) => ({
    label: definition.label,
    icon: definition.icon,
    href: BUSINESS_SOCIAL_PROFILES[definition.key]?.trim() ?? '',
  })).filter((link) => link.href.length > 0);

  readonly currentYear = new Date().getFullYear();

  constructor() {
    // El shell se monta una sola vez por sesión, así que esta carga ocurre junto
    // con el arranque inicial (no se repite al navegar entre rutas).
    // The shell is mounted once per session: the branding is read here (and shared with the landing).
    void this.brandingStore.load().catch(() => undefined);

    this.publicContentApiService
      .getLanding()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (content) => this.contactPhone.set(content.contactPhone ?? null),
        error: () => this.contactPhone.set(null),
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.closeMobileMenu();
        this.closeUserMenu();
        this.closeHeaderGroup();
      });

    if (this.standaloneQuery) {
      fromEvent<MediaQueryListEvent>(this.standaloneQuery, 'change')
        .pipe(takeUntilDestroyed())
        .subscribe((e) => this.isStandalone.set(e.matches));
    }

    if (this.tabletQuery) {
      fromEvent<MediaQueryListEvent>(this.tabletQuery, 'change')
        .pipe(takeUntilDestroyed())
        .subscribe((e) => this.isTablet.set(e.matches));
    }

    effect(() => {
      if (this.connectivityService.justReconnected()) {
        this.toastService.success('Conexion recuperada');
        this.connectivityService.acknowledgeReconnect();
      }
    });

    effect(() => {
      // Re-read so the effect reruns on every active-tab change, even though
      // the actual measurement happens in repositionBottomNavHighlight().
      this.activeShortcutIndex();
      this.bottomNavTabRefs();
      requestAnimationFrame(() => this.repositionBottomNavHighlight());
    });

    // The shortcut bar is `display: none` outside phone widths, so the first position computation can land on a
    // 0×0 box. A ResizeObserver re-measures whenever the container's real size appears.
    effect((onCleanup) => {
      const navEl = this.bottomNav()?.nativeElement;
      if (!navEl) {
        return;
      }

      const observer = new ResizeObserver(() => this.repositionBottomNavHighlight());
      observer.observe(navEl);
      onCleanup(() => observer.disconnect());
    });

    if (this.swUpdate.isEnabled) {
      fromEvent(this.document, 'visibilitychange')
        .pipe(
          filter(() => !this.document.hidden),
          takeUntilDestroyed(),
        )
        .subscribe(() => void this.swUpdate.checkForUpdate());

      // Chequeo periódico cada 5 min — necesario en iOS donde visibilitychange no dispara confiablemente en standalone.
      interval(5 * 60 * 1000)
        .pipe(takeUntilDestroyed())
        .subscribe(() => void this.swUpdate.checkForUpdate());

      this.swUpdate.versionUpdates
        .pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
          takeUntilDestroyed(),
        )
        .subscribe(() => void this.applySwUpdate());
    }
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    this.closeMobileMenu({ restoreFocus: true });
    this.closeUserMenu();
    this.closeHeaderGroup();
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    const target = event.target as Node | null;

    const userMenuEl = host.querySelector('.app-shell__user-menu');
    if (userMenuEl && !userMenuEl.contains(target)) {
      this.closeUserMenu();
    }

    const headerNavEl = host.querySelector('.app-shell__header-nav');
    if (!headerNavEl || !headerNavEl.contains(target)) {
      this.closeHeaderGroup();
    }
  }

  @HostListener('window:resize')
  handleWindowResize(): void {
    if (globalThis.innerWidth >= WIDE_LAYOUT_MIN_WIDTH) {
      this.closeMobileMenu();
    }

    this.repositionBottomNavHighlight();
  }

  private repositionBottomNavHighlight(): void {
    const index = this.activeShortcutIndex();
    const refs = this.bottomNavTabRefs();
    if (index === null || !refs[index]) {
      this.bottomNavHighlightStyle.set(null);
      return;
    }

    const el = refs[index].nativeElement;
    this.bottomNavHighlightStyle.set(computeTabHighlightStyle(el.offsetLeft, el.offsetWidth));
  }

  toggleMobileMenu(): void {
    if (this.isMobileMenuOpen()) {
      this.closeMobileMenu();
      return;
    }

    this.closeUserMenu();
    this.isMobileMenuOpen.set(true);
    this.setScrollLock(true);

    // Move the focus into the panel, so keyboard and screen-reader users land on the menu they opened.
    afterNextRender(
      () => {
        const panel = this.mobilePanel()?.nativeElement;
        const target =
          panel?.querySelector<HTMLElement>('[aria-current="page"]') ??
          panel?.querySelector<HTMLElement>('a, button');
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  closeMobileMenu(options: { restoreFocus?: boolean } = {}): void {
    if (!this.isMobileMenuOpen()) {
      return;
    }

    this.isMobileMenuOpen.set(false);
    this.setScrollLock(false);

    if (options.restoreFocus) {
      this.menuToggle()?.nativeElement.focus();
    }
  }

  toggleUserMenu(): void {
    this.closeHeaderGroup();
    this.closeMobileMenu();
    this.isUserMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  toggleHeaderGroup(groupId: NavGroupId): void {
    this.closeUserMenu();
    this.openHeaderGroupId.update((current) => (current === groupId ? null : groupId));
  }

  closeHeaderGroup(): void {
    this.openHeaderGroupId.set(null);
  }

  async installApp(): Promise<void> {
    if (this.isInstallPrompting()) {
      return;
    }

    this.isInstallPrompting.set(true);

    try {
      await this.installPromptService.promptInstall();
    } finally {
      this.isInstallPrompting.set(false);
    }
  }

  dismissInstallPrompt(): void {
    this.installPromptService.dismissPrompt();
  }

  async enablePushNotifications(): Promise<void> {
    const error = await this.pushNotificationService.enable();

    if (error) {
      this.toastService.error(error);
    } else if (this.pushNotificationService.isSubscribed()) {
      this.toastService.success('Notificaciones activadas');
    }
  }

  dismissPushPrompt(): void {
    this.pushNotificationService.dismissPrompt();
  }

  async logout(): Promise<void> {
    this.isSigningOut.set(true);

    try {
      this.closeMobileMenu();
      this.closeUserMenu();
      await this.authService.logout();
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } finally {
      this.isSigningOut.set(false);
    }
  }

  private async applySwUpdate(): Promise<void> {
    await this.swUpdate.activateUpdate();
    this.document.location.reload();
  }

  private setScrollLock(isLocked: boolean): void {
    if (!this.document?.body) {
      return;
    }

    this.document.body.style.overflow = isLocked ? 'hidden' : '';
  }
}
