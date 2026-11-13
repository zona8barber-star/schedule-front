import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * The sign-in pages are for visitors. Someone already signed in goes where the link asked (returnUrl, validated
 * like after signing in) or to the destination by role; dropping the returnUrl here lost the booking being
 * confirmed (SONDA BUG-064).
 */
export const guestGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureInitialized();

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl(authService.resolvePostAuthUrl(route.queryParamMap.get('returnUrl')));
};
