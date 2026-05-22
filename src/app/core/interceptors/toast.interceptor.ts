import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';

import { RuntimeConfigService } from '../config/runtime-config.service';
import { ToastService } from '../services/toast.service';
import { getApiErrorMessage } from '../utils/api-error.utils';

export const toastInterceptor: HttpInterceptorFn = (request, next) => {
  const runtimeConfigService = inject(RuntimeConfigService);
  const toastService = inject(ToastService);

  const apiBaseUrl = runtimeConfigService.config().apiBaseUrl.replace(/\/$/, '');
  if (!request.url.startsWith(apiBaseUrl)) {
    return next(request);
  }

  const requestPath = extractApiPath(request.url, apiBaseUrl);

  return next(request).pipe(
    tap((event) => {
      if (!(event instanceof HttpResponse)) {
        return;
      }

      const successMessage = resolveSuccessMessage(request.method, requestPath);
      if (successMessage) {
        toastService.success(successMessage);
      }
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const errorMessage = resolveErrorMessage(request.method, requestPath, error);
        if (errorMessage) {
          toastService.error(errorMessage);
        }
      }

      return throwError(() => error);
    }),
  );
};

function extractApiPath(requestUrl: string, apiBaseUrl: string): string {
  return requestUrl.slice(apiBaseUrl.length).split('?')[0] ?? '';
}

function resolveSuccessMessage(requestMethod: string, requestPath: string): string | null {
  const method = requestMethod.toUpperCase();
  if (method === 'GET') {
    return null;
  }

  if (requestPath.startsWith('/auth/')) {
    return null;
  }

  if (requestPath === '/customer/appointments' && method === 'POST') {
    return 'Reserva confirmada correctamente.';
  }

  if (requestPath.startsWith('/customer/appointments/') && requestPath.endsWith('/review')) {
    return 'Resena publicada correctamente.';
  }

  if (requestPath.includes('/appointments/') && requestPath.endsWith('/cancel')) {
    return 'La cita fue cancelada correctamente.';
  }

  if (requestPath.startsWith('/staff/availability')) {
    return 'Disponibilidad actualizada correctamente.';
  }

  if (requestPath.startsWith('/admin/staff') && method === 'POST') {
    return 'Profesional creado correctamente.';
  }

  if (requestPath.startsWith('/admin/staff') && (method === 'PUT' || method === 'PATCH')) {
    return 'Datos del profesional guardados correctamente.';
  }

  if (requestPath.startsWith('/staff/profile') && method === 'PUT') {
    return 'Perfil actualizado correctamente.';
  }

  if (requestPath === '/media/upload' && method === 'POST') {
    return 'Archivo subido correctamente.';
  }

  if (requestPath.startsWith('/media') && method === 'DELETE') {
    return 'Archivo archivado correctamente.';
  }

  if (requestPath.startsWith('/admin/content')) {
    return 'Contenido actualizado correctamente.';
  }

  if (requestPath.startsWith('/admin/appointments') || requestPath.startsWith('/staff/appointments')) {
    return 'Cambios en la cita guardados correctamente.';
  }

  return null;
}

function resolveErrorMessage(
  requestMethod: string,
  requestPath: string,
  error: HttpErrorResponse,
): string | null {
  if (requestPath.startsWith('/auth/')) {
    return null;
  }

  if (error.status === 401 || error.status === 403) {
    return null;
  }

  const method = requestMethod.toUpperCase();

  if (method === 'GET') {
    if (requestPath.startsWith('/public/content')) {
      return 'No pudimos cargar el contenido principal por ahora.';
    }

    if (requestPath.includes('/availability/slots')) {
      return 'No pudimos cargar la disponibilidad en este momento.';
    }

    if (requestPath.includes('/reviews')) {
      return 'No pudimos cargar las resenas por ahora.';
    }

    if (requestPath.startsWith('/public/staff')) {
      return 'No pudimos cargar los perfiles de profesionales por ahora.';
    }

    if (requestPath.startsWith('/customer/appointments')) {
      return 'No pudimos cargar tus citas por ahora.';
    }

    if (requestPath.startsWith('/customer/reviews')) {
      return 'No pudimos cargar tus resenas por ahora.';
    }

    if (requestPath.startsWith('/staff/availability')) {
      return 'No pudimos cargar tu disponibilidad por ahora.';
    }

    if (requestPath.startsWith('/staff/appointments')) {
      return 'No pudimos cargar tu agenda por ahora.';
    }

    if (requestPath.startsWith('/admin/appointments')) {
      return 'No pudimos cargar las citas por ahora.';
    }

    if (requestPath.startsWith('/admin/staff')) {
      return 'No pudimos cargar el listado de profesionales por ahora.';
    }

    if (requestPath.startsWith('/media')) {
      return 'No pudimos cargar la biblioteca de archivos por ahora.';
    }

    if (requestPath.startsWith('/admin/content')) {
      return 'No pudimos cargar este contenido por ahora.';
    }
  }

  if (error.status === 409 && requestPath.includes('/appointments')) {
    return 'Ese horario ya no esta disponible. Intenta con otro turno.';
  }

  if (requestPath === '/media/upload') {
    return 'No pudimos subir el archivo. Intenta nuevamente.';
  }

  if (requestPath.startsWith('/staff/availability')) {
    return 'No pudimos guardar la disponibilidad. Intenta nuevamente.';
  }

  if (requestPath.startsWith('/admin/content')) {
    return 'No pudimos guardar los cambios de contenido. Intenta nuevamente.';
  }

  if (requestPath.startsWith('/admin/staff')) {
    return 'No pudimos guardar los datos del profesional. Intenta nuevamente.';
  }

  return getApiErrorMessage(error);
}
