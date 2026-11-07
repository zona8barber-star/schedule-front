import { HttpErrorResponse } from '@angular/common/http';

/**
 * What a public catalog page shows: 'unavailable' is an unknown, inactive or deleted code (a 404, typical of an old
 * printed link) and must read as "No disponible", never as a crash; 'error' is anything else (network, server).
 */
export type PublicCatalogLoadState = 'loading' | 'ready' | 'unavailable' | 'error';

export function loadStateForError(error: unknown): PublicCatalogLoadState {
  return error instanceof HttpErrorResponse && error.status === 404 ? 'unavailable' : 'error';
}
