import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';

/**
 * SONDA BUG-139 / BUG-154: the security filter in front of the API (Cloudflare WAF) answers some texts (for example
 * «'; DROP TABLE--») with its own English «Blocked» page. That page has no CORS headers, so the browser reports it as
 * a request that never arrived (status 0) and the screens said «No pudimos conectarnos». The text is what was
 * rejected, so that is what the user is told.
 */
export const PERIMETER_BLOCK_MESSAGE =
  'El filtro de seguridad del sitio rechazó lo que escribiste. Cambia el texto (por ejemplo, quita combinaciones como «; DROP TABLE --») e inténtalo de nuevo.';

export const perimeterBlockInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBaseUrl = inject(RuntimeConfigService).config().apiBaseUrl.replace(/\/$/, '');
  // The probe goes straight to the backend: no interceptors, no token, no toasts.
  const probe = new HttpClient(inject(HttpBackend));
  const healthUrl = `${apiBaseUrl}/health`;

  if (!request.url.startsWith(apiBaseUrl) || request.url === healthUrl) {
    return next(request);
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      // Same origin (or a client that can read it): the HTML block page itself.
      if (error.status === 403 && isBlockPage(error.error)) {
        return throwError(() => blocked(error));
      }

      // Cross origin: the browser hides the block as status 0. If the API answers right away, it was not the network.
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (error.status !== 0 || !online) {
        return throwError(() => error);
      }

      return from(probeAsync(probe, healthUrl)).pipe(
        switchMap((reachable) => throwError(() => (reachable ? blocked(error) : error))),
      );
    }),
  );
};

async function probeAsync(client: HttpClient, url: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    client.get(url, { observe: 'response' }).subscribe({ next: (response) => resolve(response.ok), error: () => resolve(false) });
  });
}

export function isBlockPage(body: unknown): boolean {
  return typeof body === 'string' && /<html|cloudflare|attention required|blocked/i.test(body);
}

function blocked(error: HttpErrorResponse): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 403,
    statusText: 'Blocked',
    url: error.url ?? undefined,
    error: { title: 'Texto rechazado', status: 403, detail: PERIMETER_BLOCK_MESSAGE, code: 'perimeter_blocked' },
  });
}
