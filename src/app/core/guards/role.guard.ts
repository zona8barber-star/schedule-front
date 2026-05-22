import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { RoleName } from '../models/auth.models';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureInitialized();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  const requiredRoles = (route.data['roles'] as readonly RoleName[] | undefined) ?? [];
  if (requiredRoles.length === 0 || authService.hasAnyRole(requiredRoles)) {
    return true;
  }

  return router.parseUrl(authService.resolvePostAuthUrl());
};
