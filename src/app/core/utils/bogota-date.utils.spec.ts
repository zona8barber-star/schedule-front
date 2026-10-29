import { addDaysToDateKey, bogotaDateKey, bogotaToday, isDateKey } from './bogota-date.utils';

describe('bogota-date.utils', () => {
  it('uses the Bogotá day, not the UTC day, in the evening', () => {
    // 20:30 in Bogotá on Oct 7 is already Oct 8 in UTC.
    expect(bogotaToday(new Date('2026-10-08T01:30:00Z'))).toBe('2026-10-07');
    expect(bogotaDateKey('2026-10-08T04:59:00Z')).toBe('2026-10-07');
    expect(bogotaDateKey('2026-10-08T05:00:00Z')).toBe('2026-10-08');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysToDateKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('validates date keys', () => {
    expect(isDateKey('2026-10-07')).toBe(true);
    expect(isDateKey('2026-13-40')).toBe(false);
    expect(isDateKey('7/10/2026')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });
});
