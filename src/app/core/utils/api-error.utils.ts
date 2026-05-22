import { HttpErrorResponse } from '@angular/common/http';

import { ApiProblemDetails } from '../models/auth.models';

export function getApiErrorMessage(
  error: unknown,
  fallback = 'No pudimos completar la accion en este momento.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'No pudimos conectarnos. Verifica tu conexion e intenta nuevamente.';
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
    );

  return hasTechnicalWording ? fallback : message;
}
