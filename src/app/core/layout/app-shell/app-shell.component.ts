import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, fromEvent } from 'rxjs';

import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ToastOutletComponent } from '../../../shared/components/toast-outlet/toast-outlet.component';
import { BUSINESS_CONTACT } from '../../config/business-contact.config';
import {
  BUSINESS_SOCIAL_PROFILES,
  SOCIAL_PLATFORM_DEFINITIONS,
} from '../../config/business-social-links.config';
import { RuntimeConfigService } from '../../config/runtime-config.service';
import { ROLE_NAMES } from '../../models/auth.models';
import { AuthService } from '../../services/auth.service';
import { ConnectivityService } from '../../services/connectivity.service';
import { ConfirmModalService } from '../../services/confirm-modal.service';
import { HttpActivityService } from '../../services/http-activity.service';
import { InstallPromptService } from '../../services/install-prompt.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { ToastService } from '../../services/toast.service';

interface NavLink {
  label: string;
  route: string;
  exact?: boolean;
  group: 'public' | 'customer' | 'staff' | 'admin';
}

type BottomNavIcon = 'home' | 'staff' | 'appointments' | 'profile' | 'booking';

interface BottomNavLink {
  label: string;
  route: string;
  exact?: boolean;
  icon: BottomNavIcon;
}

interface FooterSocialLink {
  label: string;
  href: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ToastOutletComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  readonly configService = inject(RuntimeConfigService);
  readonly authService = inject(AuthService);
  readonly httpActivityService = inject(HttpActivityService);
  readonly installPromptService = inject(InstallPromptService);
  readonly pushNotificationService = inject(PushNotificationService);
  readonly connectivityService = inject(ConnectivityService);

  private readonly swUpdate = inject(SwUpdate);
  private readonly confirmModalService = inject(ConfirmModalService);
  private readonly toastService = inject(ToastService);

  readonly roleNames = ROLE_NAMES;
  readonly isSigningOut = signal(false);

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

  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly elementRef = inject(ElementRef);

  readonly navigationLinks = computed<NavLink[]>(() => {
    const links: NavLink[] = [
      {
        label: 'Inicio',
        route: '/',
        exact: true,
        group: 'public',
      },
      {
        label: 'Profesionales',
        route: '/staff',
        exact: true,
        group: 'public',
      },
    ];

    if (this.authService.hasRole(this.roleNames.customer)) {
      links.push(
        {
          label: 'Mis citas',
          route: '/customer/appointments',
          group: 'customer',
        },
        {
          label: 'Mi perfil',
          route: '/customer/profile',
          group: 'customer',
        },
      );
    }

    if (this.authService.hasRole(this.roleNames.staff)) {
      links.push(
        {
          label: 'Mi perfil',
          route: '/staff/profile',
          group: 'staff',
        },
        {
          label: 'Mi disponibilidad',
          route: '/staff/availability',
          group: 'staff',
        },
        {
          label: 'Mi agenda',
          route: '/staff/appointments',
          group: 'staff',
        },
      );
    }

    if (this.authService.hasRole(this.roleNames.admin)) {
      links.push(
        {
          label: 'Gestion de profesionales',
          route: '/admin/staff',
          group: 'admin',
        },
        {
          label: 'Citas',
          route: '/admin/appointments',
          group: 'admin',
        },
        // {
        //   label: 'Archivos',
        //   route: '/admin/media',
        //   group: 'admin',
        // },
        {
          label: 'Landing',
          route: '/admin/content/landing',
          group: 'admin',
        },
        // {
        //   label: 'Marca',
        //   route: '/admin/content/branding',
        //   group: 'admin',
        // },
        {
          label: 'Banners',
          route: '/admin/content/banners',
          group: 'admin',
        },
        {
          label: 'Notificaciones',
          route: '/admin/notifications',
          group: 'admin',
        },
        {
          label: 'Usuarios',
          route: '/admin/users',
          group: 'admin',
        },
      );
    }

    return links;
  });

  readonly primaryMobileLinks = computed(() =>
    this.navigationLinks().filter((link) => link.group !== 'admin'),
  );

  readonly adminMobileLinks = computed(() =>
    this.navigationLinks().filter((link) => link.group === 'admin'),
  );

  // Curated set for the mobile bottom tab bar: a stable, role-aware shortlist of the
  // sections people reach for constantly. Anything else stays in the "Menu" drawer.
  readonly bottomNavLinks = computed<BottomNavLink[]>(() => {
    const standalone = this.isStandalone();

    const links: BottomNavLink[] = [
      { label: 'Inicio', route: '/', exact: true, icon: 'home' },
    ];

    // En modo instalado "Reservar" se accede desde el home nativo; se omite
    // para liberar espacio para los enlaces de rol del usuario.
    if (!standalone) {
      links.push({ label: 'Reservar', route: '/booking', exact: true, icon: 'booking' });
    }

    links.push({ label: 'Equipo', route: '/staff', exact: true, icon: 'staff' });

    if (this.authService.hasRole(this.roleNames.customer)) {
      links.push(
        { label: 'Mis citas', route: '/customer/appointments', icon: 'appointments' },
        { label: 'Mi perfil', route: '/customer/profile', icon: 'profile' },
      );
    } else if (this.authService.hasRole(this.roleNames.staff)) {
      links.push(
        { label: 'Mi agenda', route: '/staff/appointments', icon: 'appointments' },
        { label: 'Mi perfil', route: '/staff/profile', icon: 'profile' },
      );
    }

    // Standalone: hasta 4 ítems (sin "Reservar" hay espacio para los de rol).
    // Browser: 3 ítems (comportamiento original).
    return links.slice(0, standalone ? 4 : 3);
  });

  readonly userDropdownCustomerLinks = computed(() =>
    this.navigationLinks().filter((link) => link.group === 'customer'),
  );

  readonly userDropdownStaffLinks = computed(() =>
    this.navigationLinks().filter((link) => link.group === 'staff'),
  );

  readonly userDropdownAdminLinks = computed(() =>
    this.navigationLinks().filter((link) => link.group === 'admin'),
  );

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
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.closeMobileMenu();
        this.closeUserMenu();
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

    if (this.swUpdate.isEnabled) {
      // Verificar actualizaciones cada vez que el usuario vuelve a la pestaña.
      fromEvent(this.document, 'visibilitychange')
        .pipe(
          filter(() => !this.document.hidden),
          takeUntilDestroyed(),
        )
        .subscribe(() => void this.swUpdate.checkForUpdate());

      // Cuando el SW ya descargó la nueva versión, ofrecer recargar.
      this.swUpdate.versionUpdates
        .pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
          takeUntilDestroyed(),
        )
        .subscribe(() => void this.promptSwUpdate());
    }
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    this.closeMobileMenu();
    this.closeUserMenu();
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    const userMenuEl = this.elementRef.nativeElement.querySelector('.app-shell__user-menu');
    if (userMenuEl && !userMenuEl.contains(event.target)) {
      this.closeUserMenu();
    }
  }

  @HostListener('window:resize')
  handleWindowResize(): void {
    if (globalThis.innerWidth > 980) {
      this.closeMobileMenu();
    }
  }

  toggleMobileMenu(): void {
    if (this.isMobileMenuOpen()) {
      this.closeMobileMenu();
      return;
    }

    this.isMobileMenuOpen.set(true);
    this.setScrollLock(true);
  }

  closeMobileMenu(): void {
    if (!this.isMobileMenuOpen()) {
      return;
    }

    this.isMobileMenuOpen.set(false);
    this.setScrollLock(false);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
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

    if (error === null) {
      this.toastService.success('Notificaciones activadas');
    } else if (error) {
      this.toastService.error(error);
    }
  }

  dismissPushPrompt(): void {
    this.pushNotificationService.dismissPrompt();
  }

  async logout(): Promise<void> {
    this.isSigningOut.set(true);

    try {
      this.closeMobileMenu();
      await this.authService.logout();
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } finally {
      this.isSigningOut.set(false);
    }
  }

  private async promptSwUpdate(): Promise<void> {
    const confirmed = await this.confirmModalService.confirm({
      title: 'Nueva versión disponible',
      message: '¿Querés recargar la app para aplicar la actualización?',
      confirmLabel: 'Actualizar',
      cancelLabel: 'Más tarde',
    });

    if (confirmed) {
      await this.swUpdate.activateUpdate();
      this.document.location.reload();
    }
  }

  private setScrollLock(isLocked: boolean): void {
    if (!this.document?.body) {
      return;
    }

    this.document.body.style.overflow = isLocked ? 'hidden' : '';
  }
}
