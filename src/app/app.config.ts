import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withNavigationErrorHandler, withViewTransitions } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

// Colombian locale: integer COP amounts render with dot thousands separators ($ 25.000).
registerLocaleData(localeEsCo);

import { environment } from '../environments/environment';
import { RuntimeConfigService } from './core/config/runtime-config.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { toastInterceptor } from './core/interceptors/toast.interceptor';
import { AuthService } from './core/services/auth.service';
import { NavigationFailureService } from './core/services/navigation-failure.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideCharts(withDefaultRegisterables()),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    provideHttpClient(withInterceptors([authInterceptor, loadingInterceptor, toastInterceptor])),
    provideRouter(
      routes,
      withViewTransitions(),
      // SONDA BUG-065: a page that could not be opened shows «Sin conexión» with «Reintentar», never a blank screen.
      withNavigationErrorHandler((error) => inject(NavigationFailureService).report(error)),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.enableServiceWorker,
      registrationStrategy: 'registerWhenStable:30000',
    }),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [RuntimeConfigService, AuthService],
      useFactory: (runtimeConfigService: RuntimeConfigService, authService: AuthService) => () =>
        runtimeConfigService.load().then(() => authService.bootstrap()),
    },
  ],
};
