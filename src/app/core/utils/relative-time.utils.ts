const relativeFormatter = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });
const dateFormatter = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

const minute = 60;
const hour = 60 * minute;
const day = 24 * hour;

/** "Ahora", "hace 5 minutos", "hace 2 horas", "ayer", "hace 3 días" o la fecha corta si pasó una semana. */
export function formatRelativeTime(isoDate: string, nowMs: number = Date.now()): string {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    return '';
  }

  const elapsedSeconds = Math.max(0, Math.round((nowMs - timestamp) / 1000));

  if (elapsedSeconds < 45) {
    return 'Ahora';
  }

  if (elapsedSeconds < hour) {
    return relativeFormatter.format(-Math.max(1, Math.round(elapsedSeconds / minute)), 'minute');
  }

  if (elapsedSeconds < day) {
    return relativeFormatter.format(-Math.round(elapsedSeconds / hour), 'hour');
  }

  if (elapsedSeconds < 7 * day) {
    return relativeFormatter.format(-Math.round(elapsedSeconds / day), 'day');
  }

  return dateFormatter.format(timestamp);
}
