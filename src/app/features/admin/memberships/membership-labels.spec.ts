import { bogotaToday, defaultEndsOn } from './membership-labels';

describe('membership-labels', () => {
  it('defaultEndsOn counts the start day, so the end date is inclusive', () => {
    expect(defaultEndsOn('2026-10-01', 30)).toBe('2026-10-30');
    expect(defaultEndsOn('2026-10-01', 1)).toBe('2026-10-01');
    expect(defaultEndsOn('2026-12-15', 30)).toBe('2027-01-13');
    expect(defaultEndsOn('2028-02-01', 29)).toBe('2028-02-29'); // leap year
  });

  it('bogotaToday uses the Bogotá date regardless of the browser time zone', () => {
    // 03:00 UTC on the 29th is still 22:00 on the 28th in Bogotá (UTC-5).
    expect(bogotaToday(new Date(Date.UTC(2026, 9, 29, 3, 0)))).toBe('2026-10-28');
    expect(bogotaToday(new Date(Date.UTC(2026, 9, 29, 5, 0)))).toBe('2026-10-29');
  });
});
