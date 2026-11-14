import { InjectionToken } from '@angular/core';

/**
 * Confirmation of money values before saving them (user decision of 2026-11-13, instead of a server-side cap for
 * SONDA BUG-080). Above this amount (COP) the dialog adds a highlighted notice that the value is unusually high; it
 * never blocks the save. Change the value here, or provide the token in a test or environment.
 */
export const UNUSUAL_AMOUNT_THRESHOLD_COP = 10_000_000;

export const UNUSUAL_AMOUNT_THRESHOLD = new InjectionToken<number>('UNUSUAL_AMOUNT_THRESHOLD', {
  providedIn: 'root',
  factory: () => UNUSUAL_AMOUNT_THRESHOLD_COP,
});
