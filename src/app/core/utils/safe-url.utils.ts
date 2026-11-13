import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const GOOGLE_HOST = /^(?:www\.|(maps\.))?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;

/**
 * Same rule as the API (SONDA BUG-047): only absolute http/https links, written with their scheme, with a host and
 * without credentials. Anything else (javascript:, data:, file:, a value without scheme that the browser would
 * resolve inside the app) yields null, so templates render no link instead of an unsafe or broken one.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  const parsed = parseHttpUrl(value);
  return parsed ? parsed.href : null;
}

/** A Google Maps link over https: maps.google.*, google.*\/maps, maps.app.goo.gl or goo.gl/maps. */
export function isGoogleMapsUrl(value: string | null | undefined): boolean {
  const url = parseHttpUrl(value);
  if (!url || url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl') return url.pathname.toLowerCase().startsWith('/maps');

  const match = GOOGLE_HOST.exec(host);
  if (!match) return false;
  return match[1] !== undefined || url.pathname.toLowerCase().startsWith('/maps');
}

/** The map link to open, or null when it is not a Google Maps link over https. */
export function safeGoogleMapsUrl(value: string | null | undefined): string | null {
  return isGoogleMapsUrl(value) ? safeHttpUrl(value) : null;
}

/** Optional field: empty is valid; otherwise it must be an absolute http/https link ({ url: true }). */
export function httpUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    isEmpty(control.value) || safeHttpUrl(String(control.value)) ? null : { url: true };
}

/** Optional field: empty is valid; otherwise it must be a Google Maps link over https ({ mapsUrl: true }). */
export function googleMapsUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    isEmpty(control.value) || isGoogleMapsUrl(String(control.value)) ? null : { mapsUrl: true };
}

function parseHttpUrl(value: string | null | undefined): URL | null {
  const trimmed = value?.trim() ?? '';
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}
