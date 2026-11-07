import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CustomerClaimStatus } from '../../../core/models/customer-claim.models';

const STATUSES: readonly CustomerClaimStatus[] = ['Pending', 'Approved', 'Rejected'];

/**
 * Keeps the URL of the claims inbox canonical: an unknown `status` falls back to Pending (the default, left out of the
 * URL) and a missing, malformed or first `page` is left out. It redirects before the page is activated, so the
 * correction replaces the bad entry without starting a second view transition. The route re-runs it on every
 * query change (`runGuardsAndResolvers: 'paramsOrQueryParamsChange'`).
 */
export const customerClaimsQueryGuard: CanActivateFn = (route) => {
  const rawStatus = route.queryParamMap.get('status');
  const rawPage = route.queryParamMap.get('page');
  const status = STATUSES.find((candidate) => candidate === rawStatus) ?? 'Pending';
  const pageNumber = Number(rawPage);
  const page = Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1;

  const canonicalStatus = status === 'Pending' ? null : status;
  const canonicalPage = page === 1 ? null : String(page);
  if (rawStatus === canonicalStatus && rawPage === canonicalPage) {
    return true;
  }

  const queryParams: Record<string, string> = { ...route.queryParams };
  delete queryParams['status'];
  delete queryParams['page'];
  if (canonicalStatus) queryParams['status'] = canonicalStatus;
  if (canonicalPage) queryParams['page'] = canonicalPage;
  const router = inject(Router);
  const path = route.pathFromRoot.flatMap((segment) => segment.url.map((part) => part.path));
  return router.createUrlTree(['/', ...path], { queryParams });
};
