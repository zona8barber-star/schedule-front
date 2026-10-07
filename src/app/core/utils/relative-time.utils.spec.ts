import { formatRelativeTime } from './relative-time.utils';

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-10-07T20:00:00Z');

  it('says "Ahora" for the last few seconds', () => {
    expect(formatRelativeTime('2026-10-07T19:59:40Z', now)).toBe('Ahora');
  });

  it('uses minutes, hours and days for recent dates', () => {
    expect(formatRelativeTime('2026-10-07T19:55:00Z', now)).toContain('5 minutos');
    expect(formatRelativeTime('2026-10-07T17:00:00Z', now)).toContain('3 horas');
    expect(formatRelativeTime('2026-10-04T20:00:00Z', now)).toContain('3 días');
  });

  it('returns an empty string for invalid dates', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('');
  });
});
