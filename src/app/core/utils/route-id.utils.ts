import { HttpErrorResponse } from '@angular/common/http';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SONDA BUG-044: an id in the URL that is not a GUID cannot exist; the page says «No encontramos…» without asking the
 * API (which answered «Not Found» in English).
 */
export function isGuid(value: string | null | undefined): value is string {
  return !!value && GUID.test(value);
}

/** The server answered that the requested record does not exist (or is no longer available). */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}
