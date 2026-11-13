import { HttpErrorResponse } from '@angular/common/http';

import { ApiProblemDetails } from '../models/auth.models';

/** The same text for every request that failed for lack of network, so the notices collapse into one (BUG-066). */
export const CONNECTIVITY_ERROR_MESSAGE = 'No pudimos conectarnos. Verifica tu conexion e intenta nuevamente.';

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

export function getApiErrorMessage(
  error: unknown,
  fallback = 'No pudimos completar la accion en este momento.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
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
  return normalizeErrorMessage(rawMessage, fallback);
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

  return hasTechnicalWording ? fallback : message;
}
