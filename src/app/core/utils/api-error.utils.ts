import { HttpErrorResponse } from '@angular/common/http';

import { ApiProblemDetails } from '../models/auth.models';

/** The same text for every request that failed for lack of network, so the notices collapse into one (BUG-066). */
export const CONNECTIVITY_ERROR_MESSAGE = 'No pudimos conectarnos. Verifica tu conexión e intenta nuevamente.';

/**
 * The request never reached the server: no network (status 0) or, with the PWA installed, the service worker's own
 * 504 answer when it has no network to forward to (SONDA BUG-045: it was shown as "No encontramos este perfil").
 */
export function isConnectivityError(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }

  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return error.status === 0 || (error.status === 504 && offline);
}

const DEFAULT_ERROR_MESSAGE = 'No pudimos completar la acción en este momento.';

/** @param fallback what the screen says when the server sent nothing usable; by default, a text for the status. */
export function getApiErrorMessage(error: unknown, fallback?: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback ?? DEFAULT_ERROR_MESSAGE;
  }

  if (isConnectivityError(error)) {
    return CONNECTIVITY_ERROR_MESSAGE;
  }

  const problemDetails =
    error.error && typeof error.error === 'object' ? (error.error as ApiProblemDetails) : undefined;

  const validationError = problemDetails?.errors
    ? Object.values(problemDetails.errors).flat()[0]
    : undefined;

  const rawMessage = validationError ?? problemDetails?.detail ?? problemDetails?.title;
  // SONDA BUG-007: whatever arrives in English (an old server, the framework's «Not Found» / «Method Not Allowed»)
  // or without text is replaced by a Spanish message for its status.
  return normalizeErrorMessage(rawMessage, fallback ?? statusMessage(error.status) ?? DEFAULT_ERROR_MESSAGE);
}

/** Spanish message for an HTTP status when the server sent none usable. */
export function statusMessage(status: number): string | null {
  switch (status) {
    case 400:
      return 'La solicitud no es válida. Revisa los datos e inténtalo de nuevo.';
    case 401:
      return 'Tu sesión no es válida o expiró. Inicia sesión de nuevo.';
    case 403:
      return 'No tienes permiso para hacer esto.';
    case 404:
      return 'No encontramos lo que buscas. Es posible que ya no exista.';
    case 405:
      return 'Esta acción no está permitida.';
    case 409:
      return 'Los datos cambiaron mientras trabajabas. Recarga la página e inténtalo de nuevo.';
    case 413:
      return 'El archivo es demasiado grande para subirlo.';
    case 422:
      return 'Hay datos que no son válidos. Revisa los campos marcados.';
    case 429:
      return 'Hiciste demasiadas solicitudes seguidas. Espera un momento y vuelve a intentarlo.';
    default:
      return status >= 500 ? 'Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.' : null;
  }
}

/**
 * True for a text written in English: only ASCII letters and at least one common English word. Spanish messages
 * («No encontramos el ingreso.», «Ya existe…») never match.
 */
export function looksEnglish(message: string): boolean {
  if (/[áéíóúñ¿¡]/i.test(message)) {
    return false;
  }

  return /\b(the|is|are|was|were|must|cannot|can|not|be|been|already|required|invalid|only|found|please|unexpected|occurred|request|exists|allowed|method|must|should|failed|unable|forbidden|unauthorized|conflict|too many|characters|between|or fewer|greater|less)\b/i.test(
    message,
  );
}

function normalizeErrorMessage(rawMessage: unknown, fallback: string): string {
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  if (!message) {
    return fallback;
  }

  const hasTechnicalWording =
    /\b(api|endpoint|stack|trace|exception|database|sql|server|storage|config|localhost|runtime|debug|mvp)\b/i.test(
      message,
    ) || /is required\.?$/i.test(message);

  return hasTechnicalWording || looksEnglish(message) ? fallback : message;
}
