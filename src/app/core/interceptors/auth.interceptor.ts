import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { AuthService } from '../services/auth.service';

const authRetriedContext = new HttpContextToken<boolean>(() => false);
const refreshExcludedPaths = new Set(['/auth/login', '/auth/register', '/auth/refresh']);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const runtimeConfigService = inject(RuntimeConfigService);

  const apiBaseUrl = runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
  if (!request.url.startsWith(apiBaseUrl)) {
    return next(request);
  }

  const requestPath = extractRequestPath(request.url, apiBaseUrl);
  const accessToken = authService.accessToken();
  const shouldAttachToken = accessToken && !refreshExcludedPaths.has(requestPath);

  const authorizedRequest = shouldAttachToken
    ? request.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      const canAttemptRefresh =
        !refreshExcludedPaths.has(requestPath) &&
        !authorizedRequest.context.get(authRetriedContext) &&
        authService.status() !== 'anonymous';

      if (!canAttemptRefresh) {
        if (!refreshExcludedPaths.has(requestPath)) {
          authService.handleUnauthorized();
        }

        return throwError(() => error);
      }

      return from(authService.refreshAccessToken()).pipe(
        switchMap((refreshedAccessToken) => {
          if (!refreshedAccessToken) {
            return throwError(() => error);
          }

          return next(
            request.clone({
              body: cloneBodyForRetry(request.body),
              setHeaders: {
                Authorization: `Bearer ${refreshedAccessToken}`,
              },
              context: request.context.set(authRetriedContext, true),
            }),
          );
        }),
        catchError((refreshError) => throwError(() => refreshError)),
      );
    }),
  );
};

function extractRequestPath(requestUrl: string, apiBaseUrl: string): string {
  return requestUrl.slice(apiBaseUrl.length).split('?')[0] ?? '';
}

function cloneBodyForRetry(body: unknown): unknown {
  if (!(body instanceof FormData)) {
    return body;
  }

  const clone = new FormData();

  body.forEach((value, key) => {
    if (value instanceof File) {
      clone.append(key, value, value.name);
      return;
    }

    clone.append(key, value);
  });

  return clone;
}
