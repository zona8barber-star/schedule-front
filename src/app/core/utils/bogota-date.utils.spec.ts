import { setDeviceTimeZone } from '../../testing/device-time-zone';
import {
  addDaysToDateKey,
  bogotaDateKey,
  bogotaDateKeyFromToday,
  bogotaDateTimeFormat,
  bogotaLocalToUtcIso,
  bogotaStartOfDay,
  bogotaToday,
  isDateKey,
  utcToBogotaLocal,
} from './bogota-date.utils';

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

  // SONDA BUG-030 / BUG-033: a staff member or admin whose device is in another timezone.
  for (const deviceZone of ['UTC', 'Asia/Tokyo', 'America/Bogota']) {
    describe(`with the device in ${deviceZone}`, () => {
      let restore: () => void;
      beforeAll(() => (restore = setDeviceTimeZone(deviceZone)));
      afterAll(() => restore());

      it('really runs in that zone (guards the test setup)', () => {
        expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(deviceZone === 'UTC' ? 'UTC' : deviceZone);
      });

      it('reads a datetime-local value as Bogotá time: 09:00 is 14:00Z', () => {
        expect(bogotaLocalToUtcIso('2026-11-25T09:00')).toBe('2026-11-25T14:00:00.000Z');
        // 21:30 in Bogotá is already the next day in UTC.
        expect(bogotaLocalToUtcIso('2026-11-25T21:30')).toBe('2026-11-26T02:30:00.000Z');
      });

      it('shows a UTC instant as Bogotá wall-clock time in a datetime-local input', () => {
        expect(utcToBogotaLocal('2026-11-25T14:00:00Z')).toBe('2026-11-25T09:00');
        expect(utcToBogotaLocal('2026-11-26T02:30:00.000Z')).toBe('2026-11-25T21:30');
        expect(utcToBogotaLocal(bogotaLocalToUtcIso('2026-01-01T00:00'))).toBe('2026-01-01T00:00');
      });

      it('formats instants in Bogotá', () => {
        const time = bogotaDateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        expect(time.format(new Date('2026-11-10T14:00:00Z'))).toBe('09:00');
      });

      it('computes Bogotá days relative to today and the start of a Bogotá day', () => {
        const evening = new Date('2026-10-08T01:30:00Z'); // Oct 7, 20:30 in Bogotá
        expect(bogotaDateKeyFromToday(0, evening)).toBe('2026-10-07');
        expect(bogotaDateKeyFromToday(1, evening)).toBe('2026-10-08');
        expect(bogotaStartOfDay('2026-10-07').toISOString()).toBe('2026-10-07T05:00:00.000Z');
      });
    });
  }

  it('rejects values that are not a datetime-local', () => {
    expect(() => bogotaLocalToUtcIso('2026-11-25')).toThrow(RangeError);
  });
});
