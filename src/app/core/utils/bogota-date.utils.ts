/** The shop works on Bogotá time, whatever the timezone of the device. */
export const BOGOTA_TIME_ZONE = 'America/Bogota';

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
