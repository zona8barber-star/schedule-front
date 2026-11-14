/** The shop works on Bogotá time, whatever the timezone of the device. */
export const BOGOTA_TIME_ZONE = 'America/Bogota';

/**
 * Bogotá's fixed UTC offset (Colombia has no daylight saving time), in the form Angular's date formatting takes. Only
 * for instants: a date-only value (YYYY-MM-DD) must never be shifted with it.
 */
export const BOGOTA_UTC_OFFSET = '-0500';

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BOGOTA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar day (YYYY-MM-DD) of an instant, in Bogotá. */
export function bogotaDateKey(value: Date | string): string {
  return dateKeyFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

/** Today's date (YYYY-MM-DD) in Bogotá. Using toISOString() would give tomorrow after 7 pm. */
export function bogotaToday(now: Date = new Date()): string {
  return bogotaDateKey(now);
}

export function isDateKey(value: string | null | undefined): value is string {
  return !!value && DATE_KEY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = dateKeyToUtcNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * A calendar day as a Date at 12:00 UTC: formatting it with timeZone 'UTC' always
 * gives back the same day, wherever the device is.
 */
export function dateKeyToUtcNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

/**
 * Bogotá is UTC-5 all year (no daylight saving time), so a fixed offset converts its wall-clock time exactly.
 * Same offset as BogotaClock in the API.
 */
const BOGOTA_UTC_OFFSET_MS = -5 * 60 * 60_000;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "Today + n days" in Bogotá (YYYY-MM-DD). */
export function bogotaDateKeyFromToday(days: number, now: Date = new Date()): string {
  return addDaysToDateKey(bogotaToday(now), days);
}

/**
 * A Bogotá wall-clock value of a `datetime-local` input (YYYY-MM-DDTHH:mm) as a UTC ISO instant, whatever the
 * timezone of the device: "2026-11-25T09:00" is always 14:00Z (SONDA BUG-030).
 */
export function bogotaLocalToUtcIso(localValue: string): string {
  if (!LOCAL_DATE_TIME_PATTERN.test(localValue)) {
    throw new RangeError(`Not a local date-time (YYYY-MM-DDTHH:mm): ${localValue}`);
  }

  const asIfUtc = Date.parse(`${localValue}:00Z`);
  return new Date(asIfUtc - BOGOTA_UTC_OFFSET_MS).toISOString();
}

/** A UTC instant as the Bogotá value of a `datetime-local` input (YYYY-MM-DDTHH:mm), whatever the device. */
export function utcToBogotaLocal(value: Date | string): string {
  const instant = typeof value === 'string' ? Date.parse(value) : value.getTime();
  return new Date(instant + BOGOTA_UTC_OFFSET_MS).toISOString().slice(0, 16);
}

/** The instant a Bogotá calendar day starts (00:00 Bogotá = 05:00Z). */
export function bogotaStartOfDay(dateKey: string): Date {
  return new Date(bogotaLocalToUtcIso(`${dateKey}T00:00`));
}

/**
 * An Intl formatter that always shows Bogotá time. Staff and admin screens format instants with it so the
 * agenda reads the same from any device timezone (SONDA BUG-033).
 */
export function bogotaDateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: BOGOTA_TIME_ZONE });
}
