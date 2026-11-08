import { addDaysToDateKey, bogotaToday, dateKeyToUtcNoon } from './bogota-date.utils';

/**
 * Date window of the paginated histories (same rule as the API's HistoryRange): every query covers at most
 * HISTORY_MAX_DAYS calendar days, both ends included, but may start at any date, so older periods are reached one
 * window at a time. With no dates a history shows the last 30 days ending today (Bogotá). Queues of pending work and
 * current items do not use a default window, so old pending items are never hidden.
 */
export const HISTORY_MAX_DAYS = 30;

export interface HistoryRange {
  from: string;
  to: string;
}

/** The last HISTORY_MAX_DAYS days ending on `today` (inclusive). */
export function defaultHistoryRange(today: string = bogotaToday()): HistoryRange {
  return { from: addDaysToDateKey(today, -(HISTORY_MAX_DAYS - 1)), to: today };
}

/**
 * The window a history actually shows: the default when both ends are empty, otherwise the missing end is completed
 * like the API does (30 days forward from `from`, or backwards from `to`).
 */
export function resolveHistoryRange(from: string, to: string, today: string = bogotaToday()): HistoryRange {
  if (!from && !to) {
    return defaultHistoryRange(today);
  }
  return {
    from: from || addDaysToDateKey(to, -(HISTORY_MAX_DAYS - 1)),
    to: to || addDaysToDateKey(from, HISTORY_MAX_DAYS - 1),
  };
}

/** Calendar days covered by an inclusive range. */
export function historyRangeDays(from: string, to: string): number {
  const days = (dateKeyToUtcNoon(to).getTime() - dateKeyToUtcNoon(from).getTime()) / 86_400_000;
  return Math.round(days) + 1;
}

/** Message for an invalid range (reversed or longer than the limit), or null when it can be queried. */
export function historyRangeError(from: string, to: string): string | null {
  if (!from || !to) {
    return null;
  }
  if (from > to) {
    return 'La fecha inicial no puede ser posterior a la final.';
  }
  if (historyRangeDays(from, to) > HISTORY_MAX_DAYS) {
    return `Puedes consultar hasta ${HISTORY_MAX_DAYS} días por vez. Acorta el rango para ver otro período.`;
  }
  return null;
}

/**
 * The range after the user picks a new start: the end is kept when the range stays valid, otherwise it moves to the
 * last allowed day (never after `max`, e.g. today for income).
 */
export function rangeWithFrom(from: string, current: HistoryRange, max: string | null = null): HistoryRange {
  if (!from) {
    return current;
  }
  let to = current.to;
  if (!to || to < from || historyRangeDays(from, to) > HISTORY_MAX_DAYS) {
    to = addDaysToDateKey(from, HISTORY_MAX_DAYS - 1);
  }
  if (max && to > max) {
    to = max < from ? from : max;
  }
  return { from, to };
}

/** The range after the user picks a new end: the start moves only when needed to keep it valid. */
export function rangeWithTo(to: string, current: HistoryRange): HistoryRange {
  if (!to) {
    return current;
  }
  let from = current.from;
  if (!from || from > to || historyRangeDays(from, to) > HISTORY_MAX_DAYS) {
    from = addDaysToDateKey(to, -(HISTORY_MAX_DAYS - 1));
  }
  return { from, to };
}

/** Short help shown next to the date inputs of a history. */
export const HISTORY_RANGE_HINT = `Hasta ${HISTORY_MAX_DAYS} días por consulta; cambia las fechas para ver otros períodos.`;

/**
 * For queues and current items: no window when both ends are empty (nothing is hidden, however old), otherwise the
 * same completed and limited window as a history.
 */
export function resolveOptionalRange(from: string, to: string): HistoryRange | null {
  return from || to ? resolveHistoryRange(from, to) : null;
}
