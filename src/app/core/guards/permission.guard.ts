import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { PermissionCode } from '../models/auth.models';
import { AuthService } from '../services/auth.service';

/** Allows the route when the user holds any of `data.permissions`; a route without permissions only needs a session. */
export const permissionGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureInitialized();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  const requiredPermissions =
    (route.data['permissions'] as readonly PermissionCode[] | undefined) ?? [];
  if (requiredPermissions.length === 0 || authService.hasAnyPermission(requiredPermissions)) {
    return true;
  }

  return router.parseUrl(authService.resolvePostAuthUrl());
};
