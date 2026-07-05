import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { ROLE_NAMES } from './core/models/auth.models';

const loadScaffoldSection = () =>
  import('./shared/components/scaffold-section/scaffold-section.component').then(
    (module) => module.ScaffoldSectionComponent,
  );

const loadAdminStaffListPage = () =>
  import('./features/admin/staff/pages/admin-staff-list-page/admin-staff-list-page.component').then(
    (module) => module.AdminStaffListPageComponent,
  );

const loadAdminStaffFormPage = () =>
  import('./features/admin/staff/pages/admin-staff-form-page/admin-staff-form-page.component').then(
    (module) => module.AdminStaffFormPageComponent,
  );

const loadAdminServicesListPage = () =>
  import('./features/admin/services/pages/admin-services-list-page/admin-services-list-page.component').then(
    (module) => module.AdminServicesListPageComponent,
  );

const loadAdminIncomeListPage = () =>
  import('./features/admin/income/pages/admin-income-list-page/admin-income-list-page.component').then(
    (module) => module.AdminIncomeListPageComponent,
  );

const loadStaffProfilePage = () =>
  import('./features/staff/profile/pages/staff-profile-page/staff-profile-page.component').then(
    (module) => module.StaffProfilePageComponent,
  );

const loadStaffAvailabilityPage = () =>
  import('./features/staff/availability/pages/staff-availability-page/staff-availability-page.component').then(
    (module) => module.StaffAvailabilityPageComponent,
  );

const loadStaffAppointmentsPage = () =>
  import('./features/staff/appointments/pages/staff-appointments-page/staff-appointments-page.component').then(
    (module) => module.StaffAppointmentsPageComponent,
  );

const loadPublicStaffListPage = () =>
  import('./features/public/staff/pages/public-staff-list-page/public-staff-list-page.component').then(
    (module) => module.PublicStaffListPageComponent,
  );

const loadPublicStaffProfilePage = () =>
  import('./features/public/staff/pages/public-staff-profile-page/public-staff-profile-page.component').then(
    (module) => module.PublicStaffProfilePageComponent,
  );

const loadResetPasswordPage = () =>
  import('./features/auth/pages/reset-password-page/reset-password-page.component').then(
    (module) => module.ResetPasswordPageComponent,
  );

const loadBookingConfirmPage = () =>
  import('./features/booking/pages/booking-confirm-page/booking-confirm-page.component').then(
    (module) => module.BookingConfirmPageComponent,
  );

const loadBookingLandingPage = () =>
  import('./features/booking/pages/booking-landing-page/booking-landing-page.component').then(
    (module) => module.BookingLandingPageComponent,
  );

const loadCustomerAppointmentsPage = () =>
  import('./features/customer/appointments/pages/customer-appointments-page/customer-appointments-page.component').then(
    (module) => module.CustomerAppointmentsPageComponent,
  );

const loadCustomerProfilePage = () =>
  import('./features/customer/profile/pages/customer-profile-page/customer-profile-page.component').then(
    (module) => module.CustomerProfilePageComponent,
  );

const loadCustomerReviewsPage = () =>
  import('./features/customer/reviews/pages/customer-reviews-page/customer-reviews-page.component').then(
    (module) => module.CustomerReviewsPageComponent,
  );

const loadAdminAppointmentsPage = () =>
  import('./features/admin/appointments/pages/admin-appointments-page/admin-appointments-page.component').then(
    (module) => module.AdminAppointmentsPageComponent,
  );

const loadAdminMediaManagerPage = () =>
  import('./features/media/pages/admin-media-manager-page/admin-media-manager-page.component').then(
    (module) => module.AdminMediaManagerPageComponent,
  );

const loadAdminLandingContentPage = () =>
  import('./features/admin/landing-content/pages/admin-landing-content-page/admin-landing-content-page.component').then(
    (module) => module.AdminLandingContentPageComponent,
  );

const loadAdminBrandingPage = () =>
  import('./features/admin/branding/pages/admin-branding-page/admin-branding-page.component').then(
    (module) => module.AdminBrandingPageComponent,
  );

const loadAdminBannersPage = () =>
  import('./features/admin/banners/pages/admin-banners-page/admin-banners-page.component').then(
    (module) => module.AdminBannersPageComponent,
  );

const loadAdminNotificationsPage = () =>
  import(
    './features/admin/notifications/pages/admin-notifications-page/admin-notifications-page.component'
  ).then((module) => module.AdminNotificationsPageComponent);

const loadAdminBusinessHoursPage = () =>
  import(
    './features/admin/business-hours/pages/admin-business-hours-page/admin-business-hours-page.component'
  ).then((module) => module.AdminBusinessHoursPageComponent);

const loadAdminUsersListPage = () =>
  import('./features/admin/users/pages/admin-users-list-page/admin-users-list-page.component').then(
    (module) => module.AdminUsersListPageComponent,
  );

const loadAdminFixedExpensesListPage = () =>
  import('./features/admin/fixed-expenses/pages/admin-fixed-expenses-list-page/admin-fixed-expenses-list-page.component').then(
    (module) => module.AdminFixedExpensesListPageComponent,
  );

const loadAdminExpensesListPage = () =>
  import('./features/admin/expenses/pages/admin-expenses-list-page/admin-expenses-list-page.component').then(
    (module) => module.AdminExpensesListPageComponent,
  );

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/pages/landing-shell-page/landing-shell-page.component').then(
        (module) => module.LandingShellPageComponent,
      ),
    title: 'Zona 8',
  },
  {
    path: 'public',
    loadComponent: loadScaffoldSection,
    data: {
      title: 'Area publica',
      description: 'Explora la landing, los perfiles profesionales y su disponibilidad.',
    },
  },
  {
    path: 'auth',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login',
      },
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/pages/login-page/login-page.component').then(
            (module) => module.LoginPageComponent,
          ),
        title: 'Iniciar sesion',
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/pages/login-page/login-page.component').then(
            (module) => module.LoginPageComponent,
          ),
        title: 'Acceso',
      },
      {
        path: 'reset-password',
        loadComponent: loadResetPasswordPage,
        title: 'Restablecer contraseña',
      },
    ],
  },
  {
    path: 'booking',
    pathMatch: 'full',
    loadComponent: loadBookingLandingPage,
    title: 'Reservar',
  },
  {
    path: 'booking/confirm',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadBookingConfirmPage,
    data: {
      roles: [ROLE_NAMES.customer],
    },
    title: 'Confirmar reserva',
  },
  {
    path: 'customer',
    pathMatch: 'full',
    redirectTo: 'customer/appointments',
  },
  {
    path: 'customer/appointments',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadCustomerAppointmentsPage,
    data: {
      roles: [ROLE_NAMES.customer],
    },
    title: 'Mis citas',
  },
  {
    path: 'customer/profile',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadCustomerProfilePage,
    data: {
      roles: [ROLE_NAMES.customer],
    },
    title: 'Mi perfil',
  },
  {
    path: 'customer/reviews',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadCustomerReviewsPage,
    data: {
      roles: [ROLE_NAMES.customer],
    },
    title: 'Mis resenas',
  },
  {
    path: 'staff/profile',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadStaffProfilePage,
    data: {
      roles: [ROLE_NAMES.staff],
    },
    title: 'Mi perfil',
  },
  {
    path: 'staff/availability',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadStaffAvailabilityPage,
    data: {
      roles: [ROLE_NAMES.staff],
    },
    title: 'Mi disponibilidad',
  },
  {
    path: 'staff/appointments',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadStaffAppointmentsPage,
    data: {
      roles: [ROLE_NAMES.staff],
    },
    title: 'Agenda',
  },
  {
    path: 'staff/:staffProfileId',
    loadComponent: loadPublicStaffProfilePage,
    title: 'Perfil profesional',
  },
  {
    path: 'staff',
    pathMatch: 'full',
    loadComponent: loadPublicStaffListPage,
    title: 'Profesionales',
  },
  {
    path: 'admin',
    pathMatch: 'full',
    redirectTo: 'admin/staff',
  },
  {
    path: 'admin/staff',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminStaffListPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Gestion de profesionales',
  },
  {
    path: 'admin/appointments',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminAppointmentsPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Citas',
  },
  {
    path: 'admin/services',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminServicesListPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Servicios',
  },
  {
    path: 'admin/income',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminIncomeListPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Ingresos',
  },
  {
    path: 'admin/expenses',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminExpensesListPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Gastos',
  },
  {
    path: 'admin/expenses/fixed',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminFixedExpensesListPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Gastos fijos',
  },
  {
    path: 'admin/staff/new',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminStaffFormPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Crear profesional',
  },
  {
    path: 'admin/staff/:staffId/edit',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminStaffFormPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Editar profesional',
  },
  {
    path: 'admin/media',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminMediaManagerPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Biblioteca de archivos',
  },
  {
    path: 'admin/content/landing',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminLandingContentPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Landing',
  },
  {
    path: 'admin/content/branding',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminBrandingPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Marca',
  },
  {
    path: 'admin/content/banners',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminBannersPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Banners',
  },
  {
    path: 'admin/content/business-hours',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminBusinessHoursPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Horario de atención',
  },
  {
    path: 'admin/notifications',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminNotificationsPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Notificaciones',
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, roleGuard],
    loadComponent: loadAdminUsersListPage,
    data: {
      roles: [ROLE_NAMES.admin],
    },
    title: 'Usuarios',
  },
  {
    path: 'media',
    pathMatch: 'full',
    redirectTo: 'admin/media',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
