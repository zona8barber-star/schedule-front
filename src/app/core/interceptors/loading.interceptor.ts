import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { HttpActivityService } from '../services/http-activity.service';

export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  const runtimeConfigService = inject(RuntimeConfigService);
  const httpActivityService = inject(HttpActivityService);

  const apiBaseUrl = runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
  if (!request.url.startsWith(apiBaseUrl)) {
    return next(request);
  }

  httpActivityService.begin();

  return next(request).pipe(
    finalize(() => {
      httpActivityService.end();
    }),
  );
};
